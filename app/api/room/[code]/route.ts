import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCandidateSlots } from "@/lib/room-schedule-helpers";

interface Params {
  params: Promise<{ code: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const code = (resolvedParams.code ?? "").trim();

  if (!code) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      schedules: {
        select: { userId: true, data: true, submittedAt: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  const submittedUserIds = new Set(
    room.schedules.map((s: { userId: number }) => s.userId),
  );
  const submittedCount = submittedUserIds.size;
  const result = room.confirmedTime;

  const latestBidByUser = new Map<number, number>();
  for (const schedule of room.schedules) {
    if (latestBidByUser.has(schedule.userId)) {
      continue;
    }

    const raw = schedule.data as { bidAmount?: number };
    const bidAmount = Number.isFinite(Number(raw.bidAmount))
      ? Math.max(0, Math.floor(Number(raw.bidAmount)))
      : 0;
    latestBidByUser.set(schedule.userId, bidAmount);
  }

  const leadingBid = Math.max(0, ...latestBidByUser.values());

  let status: "waiting" | "ready" | "completed";
  if (result) {
    status = "completed";
  } else if (submittedCount >= room.capacity) {
    status = "ready";
  } else {
    status = "waiting";
  }

  const candidateSlots =
    status === "ready" || status === "completed"
      ? await computeCandidateSlots(prisma, room.id)
      : [];

  const auctionBids = await prisma.roomBid.findMany({ where: { roomId: room.id } });

  let auctionReadyCount = 0;
  let auctionRequiredCount = 0;
  const slotTotals: Record<string, number> = {};

  if (room.auctionStartedAt && !room.confirmedTime) {
    auctionRequiredCount = submittedCount;
    for (const uid of submittedUserIds) {
      const b = auctionBids.find((x) => x.userId === uid);
      if (b?.isReady) auctionReadyCount += 1;
    }

    for (const b of auctionBids) {
      if (
        !b.isReady ||
        !b.slotKey ||
        b.bidAmount <= 0 ||
        !candidateSlots.includes(b.slotKey)
      ) {
        continue;
      }
      slotTotals[b.slotKey] = (slotTotals[b.slotKey] ?? 0) + b.bidAmount;
    }
  }

  const qUser = req.nextUrl.searchParams.get("userId");
  let myAuctionBid: {
    slotKey: string | null;
    bidAmount: number;
    isReady: boolean;
  } | null = null;
  const uid = qUser ? Number(qUser) : NaN;
  if (!Number.isNaN(uid)) {
    const row = auctionBids.find((b) => b.userId === uid);
    if (row) {
      myAuctionBid = {
        slotKey: row.slotKey,
        bidAmount: row.bidAmount,
        isReady: row.isReady,
      };
    }
  }

  return NextResponse.json({
    code: room.code,
    capacity: room.capacity,
    hostId: room.hostId,
    confirmedTime: room.confirmedTime,
    decisionMode: room.decisionMode,
    auctionStartedAt: room.auctionStartedAt?.toISOString() ?? null,
    auctionWinnerId: room.auctionWinnerId,
    auctionWinningBid: room.auctionWinningBid,
    leadingBid,
    /** 하위 호환 */
    confirmedSlot: room.confirmedTime,
    result,
    submittedCount,
    status,
    candidateSlots,
    auctionReadyCount,
    auctionRequiredCount,
    slotTotals,
    myAuctionBid,
  });
}
