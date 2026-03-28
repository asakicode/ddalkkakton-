import type { PrismaClient } from "@prisma/client";
import { commonFreeSlots } from "@/lib/candidate-slots";

type ScheduleData = { blocked?: string[] };

export async function getRoomParticipantUserIds(
  prisma: Pick<PrismaClient, "schedule">,
  roomId: number,
): Promise<number[]> {
  const schedules = await prisma.schedule.findMany({
    where: { roomId },
    select: { userId: true },
    distinct: ["userId"],
  });
  return schedules.map((s) => s.userId);
}

export async function getLatestBlockedByUser(
  prisma: Pick<PrismaClient, "schedule">,
  roomId: number,
): Promise<Map<number, Set<string>>> {
  const rows = await prisma.schedule.findMany({
    where: { roomId },
    orderBy: { submittedAt: "desc" },
  });
  const map = new Map<number, Set<string>>();
  for (const s of rows) {
    if (map.has(s.userId)) continue;
    const raw = s.data as ScheduleData;
    map.set(s.userId, new Set(raw.blocked ?? []));
  }
  return map;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

type DecisionMode = "BID_POOL" | "BID_ALL_ZERO";

/**
 * 모든 참가자가 isReady이고 방이 아직 미확정일 때만 정산합니다.
 * 트랜잭션 안에서 호출하세요.
 */
export async function trySettleLiveAuction(
  tx: Pick<PrismaClient, "room" | "roomBid" | "user" | "schedule">,
  roomId: number,
): Promise<
  | { settled: false }
  | {
      settled: true;
      winningSlot: string;
      decisionMode: DecisionMode;
    }
> {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || room.confirmedTime || !room.auctionStartedAt) {
    return { settled: false };
  }

  const participantIds = await getRoomParticipantUserIds(tx, roomId);
  if (participantIds.length < room.capacity) {
    return { settled: false };
  }

  const blockedMap = await getLatestBlockedByUser(tx, roomId);
  const blockedByUser = participantIds.map((id) => blockedMap.get(id) ?? new Set<string>());
  const candidateSlots = commonFreeSlots(blockedByUser);
  if (candidateSlots.length === 0) {
    return { settled: false };
  }

  const bids = await tx.roomBid.findMany({ where: { roomId } });
  const byUser = new Map(bids.map((b) => [b.userId, b]));

  for (const uid of participantIds) {
    const b = byUser.get(uid);
    if (!b?.isReady) return { settled: false };
  }

  const totals = new Map<string, number>();
  for (const s of candidateSlots) totals.set(s, 0);

  for (const b of bids) {
    if (
      !b.isReady ||
      !b.slotKey ||
      !candidateSlots.includes(b.slotKey) ||
      b.bidAmount <= 0
    ) {
      continue;
    }
    totals.set(b.slotKey, (totals.get(b.slotKey) ?? 0) + b.bidAmount);
  }

  const maxTotal = Math.max(...candidateSlots.map((s) => totals.get(s) ?? 0));
  let winningSlot: string;
  let decisionMode: DecisionMode;

  if (maxTotal === 0) {
    winningSlot = pickRandom(candidateSlots);
    decisionMode = "BID_ALL_ZERO";
  } else {
    const top = candidateSlots.filter((s) => (totals.get(s) ?? 0) === maxTotal);
    winningSlot = pickRandom(top);
    decisionMode = "BID_POOL";
  }

  const payers = bids.filter(
    (b) =>
      b.isReady &&
      b.slotKey === winningSlot &&
      candidateSlots.includes(b.slotKey!) &&
      b.bidAmount > 0,
  );

  for (const b of payers) {
    const u = await tx.user.findUnique({ where: { id: b.userId } });
    if (!u || u.balance < b.bidAmount) {
      throw new Error(
        `SETTLE_INSUFFICIENT_BALANCE:${b.userId}:${b.bidAmount}:${u?.balance ?? 0}`,
      );
    }
  }

  const claim = await tx.room.updateMany({
    where: { id: roomId, confirmedTime: null },
    data: {
      confirmedTime: winningSlot,
      decisionMode,
      confirmedAt: new Date(),
      auctionStartedAt: null,
    },
  });

  if (claim.count === 0) {
    return { settled: false };
  }

  for (const b of payers) {
    await tx.user.update({
      where: { id: b.userId },
      data: { balance: { decrement: b.bidAmount } },
    });
  }

  return { settled: true, winningSlot, decisionMode };
}
