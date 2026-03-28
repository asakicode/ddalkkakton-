import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ code: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const resolvedParams = await params;
  const code = (resolvedParams.code ?? "").trim();
  const normalized = code.toUpperCase();

  if (!normalized) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }
  const room = await prisma.room.findUnique({
    where: { code: normalized },
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

  return NextResponse.json({
    code: room.code,
    capacity: room.capacity,
    hostId: room.hostId,
    confirmedTime: room.confirmedTime,
    decisionMode: room.decisionMode,
    auctionWinnerId: room.auctionWinnerId,
    auctionWinningBid: room.auctionWinningBid,
    leadingBid,
    /** 하위 호환 */
    confirmedSlot: room.confirmedTime,
    result,
    submittedCount,
    status,
  });
}

