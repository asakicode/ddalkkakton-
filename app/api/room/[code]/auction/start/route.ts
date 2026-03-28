import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveRoomAuction, type AuctionParticipant } from "@/lib/auction";

type Params = { params: Promise<{ code: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const { code: raw } = await ctx.params;
  const code = raw.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code },
    include: { schedules: { select: { userId: true } } },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (room.confirmedTime) {
    return NextResponse.json({ error: "이미 시간이 확정된 방입니다." }, { status: 400 });
  }

  const submitted = new Set(room.schedules.map((s: { userId: number }) => s.userId));
  if (submitted.size < room.capacity) {
    return NextResponse.json(
      { error: "아직 모든 인원이 시간표를 제출하지 않았습니다." },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const schedules = await tx.schedule.findMany({
      where: { roomId: room.id },
      include: { user: true },
      orderBy: { submittedAt: "desc" },
    });

    const latestByUser = new Map<number, AuctionParticipant>();
    for (const schedule of schedules) {
      if (latestByUser.has(schedule.userId)) {
        continue;
      }

      const raw = schedule.data as {
        blocked?: string[];
        preferredSlot?: string | null;
        bidAmount?: number;
      };

      latestByUser.set(schedule.userId, {
        userId: schedule.userId,
        balance: schedule.user.balance,
        blocked: new Set(raw.blocked ?? []),
        preferredSlot:
          typeof raw.preferredSlot === "string" && raw.preferredSlot.trim()
            ? raw.preferredSlot.trim()
            : null,
        bidAmount: Number.isFinite(Number(raw.bidAmount))
          ? Math.max(0, Math.floor(Number(raw.bidAmount)))
          : 0,
      });
    }

    const participants = Array.from(latestByUser.values());
    if (participants.length < room.capacity) {
      throw new Error("NOT_ALL_SUBMITTED");
    }

    const resolution = resolveRoomAuction(participants);

    for (const charge of resolution.charges) {
      const target = participants.find((participant) => participant.userId === charge.userId);
      if (!target || target.balance < charge.amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
    }

    for (const charge of resolution.charges) {
      await tx.user.update({
        where: { id: charge.userId },
        data: { balance: { decrement: charge.amount } },
      });
    }

    await tx.roomBid.deleteMany({ where: { roomId: room.id } });

    const updatedRoom = await tx.room.update({
      where: { id: room.id },
      data: {
        confirmedTime: resolution.confirmedTime,
        decisionMode: resolution.decisionMode,
        auctionStartedAt: new Date(),
        auctionWinnerId: resolution.winnerUserId,
        auctionWinningBid: resolution.winningBid,
        confirmedAt: new Date(),
      },
    });

    return {
      confirmedTime: updatedRoom.confirmedTime,
      decisionMode: updatedRoom.decisionMode,
      auctionWinnerId: updatedRoom.auctionWinnerId,
      auctionWinningBid: updatedRoom.auctionWinningBid,
    };
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_ALL_SUBMITTED") {
      return { error: "아직 모든 인원이 시간표를 제출하지 않았습니다.", status: 400 as const };
    }

    if (message === "INSUFFICIENT_BALANCE") {
      return { error: "예치금이 부족해 결과를 확정할 수 없습니다.", status: 400 as const };
    }

    throw error;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    status: "confirmed",
    confirmedTime: result.confirmedTime,
    decisionMode: result.decisionMode,
    auctionWinnerId: result.auctionWinnerId,
    auctionWinningBid: result.auctionWinningBid,
  });
}
