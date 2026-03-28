import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveRoomAuction,
  type AuctionCharge,
  type AuctionParticipant,
} from "@/lib/auction";

type SchedulePayload = {
  blocked?: string[];
  preferredSlot?: string | null;
  bidAmount?: number;
};

type LockedRoom = {
  id: number;
  confirmedTime: string | null;
  decisionMode: string | null;
  auctionWinnerId: number | null;
  auctionWinningBid: number | null;
};

function buildLatestParticipants(
  schedules: Array<{
    userId: number;
    data: unknown;
    user: { balance: number };
  }>,
) {
  const latestByUser = new Map<number, AuctionParticipant>();

  for (const schedule of schedules) {
    if (latestByUser.has(schedule.userId)) {
      continue;
    }

    const raw = schedule.data as SchedulePayload;
    const bidAmount = Number.isFinite(Number(raw.bidAmount))
      ? Math.max(0, Math.floor(Number(raw.bidAmount)))
      : 0;

    latestByUser.set(schedule.userId, {
      userId: schedule.userId,
      blocked: new Set(raw.blocked ?? []),
      preferredSlot: raw.preferredSlot?.trim() || null,
      bidAmount,
      balance: schedule.user.balance,
    });
  }

  return Array.from(latestByUser.values());
}

function mergeCharges(charges: AuctionCharge[]) {
  const merged = new Map<number, number>();

  for (const charge of charges) {
    merged.set(charge.userId, (merged.get(charge.userId) ?? 0) + charge.amount);
  }

  return Array.from(merged.entries()).map(([userId, amount]) => ({ userId, amount }));
}

export async function POST(req: NextRequest) {
  let roomCode: string | undefined;
  try {
    const body = await req.json();
    roomCode = typeof body?.roomCode === "string" ? body.roomCode : undefined;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const code = (roomCode ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "roomCode가 필요합니다." }, { status: 400 });
  }

  const codeVariants = Array.from(new Set([code, code.toUpperCase()]));

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let lockedRoom: LockedRoom | undefined;
    for (const candidate of codeVariants) {
      const lockedRooms = await tx.$queryRaw<LockedRoom[]>`
        SELECT "id", "confirmedTime", "decisionMode", "auctionWinnerId", "auctionWinningBid"
        FROM "Room"
        WHERE "code" = ${candidate}
        FOR UPDATE
      `;
      lockedRoom = lockedRooms[0];
      if (lockedRoom) break;
    }
    if (!lockedRoom) {
      return { kind: "not-found" as const };
    }

    if (lockedRoom.confirmedTime) {
      return {
        kind: "already-confirmed" as const,
        confirmedTime: lockedRoom.confirmedTime,
        decisionMode: lockedRoom.decisionMode,
        auctionWinnerId: lockedRoom.auctionWinnerId,
        auctionWinningBid: lockedRoom.auctionWinningBid,
      };
    }

    const schedules = await tx.schedule.findMany({
      where: { roomId: lockedRoom.id },
      include: { user: true },
      orderBy: { submittedAt: "desc" },
    });

    if (schedules.length === 0) {
      return { kind: "no-schedules" as const };
    }

    const participants = buildLatestParticipants(schedules);
    let resolution;
    try {
      resolution = resolveRoomAuction(participants);
    } catch (error) {
      return {
        kind: "invalid" as const,
        error: error instanceof Error ? error.message : "빈 시간을 찾을 수 없습니다.",
      };
    }

    const charges = mergeCharges(resolution.charges).filter((charge) => charge.amount > 0);

    for (const charge of charges) {
      await tx.user.update({
        where: { id: charge.userId },
        data: {
          balance: {
            decrement: charge.amount,
          },
        },
      });
    }

    const updatedRoom = await tx.room.update({
      where: { id: lockedRoom.id },
      data: {
        confirmedTime: resolution.confirmedTime,
        decisionMode: resolution.decisionMode,
        auctionWinnerId: resolution.winnerUserId,
        auctionWinningBid: resolution.winningBid,
        confirmedAt: new Date(),
      },
    });

    const balances = charges.length
      ? await tx.user.findMany({
          where: { id: { in: charges.map((charge) => charge.userId) } },
          select: { id: true, balance: true },
        })
      : [];

    return {
      kind: "confirmed" as const,
      confirmedTime: updatedRoom.confirmedTime,
      decisionMode: updatedRoom.decisionMode,
      auctionWinnerId: updatedRoom.auctionWinnerId,
      auctionWinningBid: updatedRoom.auctionWinningBid,
      chargedUsers: charges.map((charge) => ({
        userId: charge.userId,
        deductedAmount: charge.amount,
        balance:
          balances.find((balance: { id: number; balance: number }) => balance.id === charge.userId)
            ?.balance ?? null,
      })),
      eligibleBidderCount: resolution.eligibleBidderCount,
    };
  });

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (result.kind === "no-schedules") {
    return NextResponse.json({ error: "제출된 시간표가 없습니다." }, { status: 400 });
  }

  if (result.kind === "invalid") {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.kind === "already-confirmed") {
    return NextResponse.json({
      status: "already-confirmed",
      confirmedTime: result.confirmedTime,
      decisionMode: result.decisionMode,
      auctionWinnerId: result.auctionWinnerId,
      auctionWinningBid: result.auctionWinningBid,
    });
  }

  return NextResponse.json({
    status: "confirmed",
    confirmedTime: result.confirmedTime,
    decisionMode: result.decisionMode,
    auctionWinnerId: result.auctionWinnerId,
    auctionWinningBid: result.auctionWinningBid,
    chargedUsers: result.chargedUsers,
    eligibleBidderCount: result.eligibleBidderCount,
  });
}
