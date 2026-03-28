import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCandidateSlots } from "@/lib/room-schedule-helpers";
import { trySettleLiveAuction } from "@/lib/auction-room";

type Params = { params: { code: string } | Promise<{ code: string }> };

function parseAmount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

export async function POST(req: NextRequest, ctx: Params) {
  const { code: raw } = await Promise.resolve(ctx.params as { code: string });
  const code = raw.trim();
  if (!code) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const { userId, slotKey, bidAmount, confirm, anywhere } = (body ?? {}) as {
    userId?: number;
    slotKey?: string | null;
    bidAmount?: number;
    confirm?: boolean;
    anywhere?: boolean;
  };

  if (!userId || typeof userId !== "number") {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code },
    include: { schedules: { select: { userId: true } } },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (room.confirmedTime) {
    return NextResponse.json({ error: "이미 시간이 확정되었습니다." }, { status: 400 });
  }

  if (!room.auctionStartedAt) {
    return NextResponse.json(
      { error: "경매가 시작되지 않았습니다. 먼저 룰렛에서 경매를 시작하세요." },
      { status: 400 },
    );
  }

  const participants = new Set(room.schedules.map((s) => s.userId));
  if (!participants.has(userId)) {
    return NextResponse.json(
      { error: "이 방에 시간표를 제출한 멤버만 배팅할 수 있습니다." },
      { status: 403 },
    );
  }

  const candidateSlots = await computeCandidateSlots(prisma, room.id);
  if (candidateSlots.length === 0) {
    return NextResponse.json(
      { error: "유효한 후보 시간이 없습니다." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const existing = await prisma.roomBid.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
  });

  if (existing?.isReady) {
    return NextResponse.json(
      { error: "이미 확정했습니다. 배팅을 바꿀 수 없습니다." },
      { status: 400 },
    );
  }

  let finalSlot: string | null;
  let finalAmount: number;
  let finalReady: boolean;

  if (anywhere === true) {
    finalSlot = null;
    finalAmount = 0;
    finalReady = true;
  } else {
    const key =
      typeof slotKey === "string" && slotKey.trim() ? slotKey.trim() : null;
    finalAmount = parseAmount(bidAmount);
    finalReady = confirm === true;

    if (key !== null && !candidateSlots.includes(key)) {
      return NextResponse.json(
        { error: "후보에 없는 시간대입니다." },
        { status: 400 },
      );
    }

    if (finalReady && key === null) {
      return NextResponse.json(
        { error: "시간대를 선택하거나 '어디든 상관없음'을 눌러주세요." },
        { status: 400 },
      );
    }

    if (finalReady && finalAmount > user.balance) {
      return NextResponse.json(
        {
          error: `예치금이 부족합니다. (배팅 ${finalAmount.toLocaleString()}P, 보유 ${user.balance.toLocaleString()}P)`,
        },
        { status: 400 },
      );
    }

    finalSlot = key;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const live = await tx.room.findUnique({ where: { id: room.id } });
      if (live?.confirmedTime) {
        return null;
      }

      await tx.roomBid.upsert({
        where: { roomId_userId: { roomId: room.id, userId } },
        create: {
          roomId: room.id,
          userId,
          slotKey: finalSlot,
          bidAmount: finalAmount,
          isReady: finalReady,
        },
        update: {
          slotKey: finalSlot,
          bidAmount: finalAmount,
          isReady: finalReady,
        },
      });

      return trySettleLiveAuction(tx, room.id);
    });

    const after = await prisma.room.findUnique({ where: { id: room.id } });

    if (after?.confirmedTime) {
      return NextResponse.json({
        status: "confirmed",
        confirmedTime: after.confirmedTime,
        decisionMode: after.decisionMode,
        winningSlot: result?.settled ? result.winningSlot : undefined,
      });
    }

    if (result?.settled) {
      return NextResponse.json({
        status: "confirmed",
        confirmedTime: after?.confirmedTime,
        decisionMode: after?.decisionMode,
        winningSlot: result.winningSlot,
      });
    }

    return NextResponse.json({
      status: "bidding",
      slotKey: finalSlot,
      bidAmount: finalAmount,
      isReady: finalReady,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("SETTLE_INSUFFICIENT_BALANCE:")) {
      return NextResponse.json(
        {
          error:
            "정산 시 예치금이 부족한 배팅이 있습니다. 금액을 낮춘 뒤 다시 시도해주세요.",
        },
        { status: 400 },
      );
    }
    throw e;
  }
}
