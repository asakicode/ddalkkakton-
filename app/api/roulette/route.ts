import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { allSlotKeys, SCHEDULE_DAYS, SCHEDULE_HOURS } from "@/lib/slot-keys";

type DecisionMode =
  | "COMMON_PREFERRED"
  | "COMMON_RANDOM_ZERO"
  | "COMMON_RANDOM_FALLBACK"
  | "AUCTION";

type SchedulePayload = {
  blocked?: string[];
  preferredSlot?: string | null;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function commonFreeSlots(
  blockedByUser: Set<string>[],
): string[] {
  const out: string[] = [];
  for (const day of SCHEDULE_DAYS) {
    for (const time of SCHEDULE_HOURS) {
      const key = `${day}-${time}`;
      const allFree = blockedByUser.every((set) => !set.has(key));
      if (allFree) out.push(key);
    }
  }
  return out;
}

// 강제 시간 확정 (예치금 경매 알고리즘): POST /api/roulette
export async function POST(req: NextRequest) {
  const { roomCode } = await req.json();
  if (!roomCode) {
    return NextResponse.json({ error: "roomCode가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (room.confirmedTime) {
    return NextResponse.json({
      status: "already-confirmed",
      confirmedTime: room.confirmedTime,
      decisionMode: room.decisionMode,
    });
  }

  const schedules = await prisma.schedule.findMany({
    where: { roomId: room.id },
    include: { user: true },
    orderBy: { submittedAt: "desc" },
  });

  if (schedules.length === 0) {
    return NextResponse.json({ error: "제출된 시간표가 없습니다." }, { status: 400 });
  }

  const latestByUser = new Map<
    number,
    { blocked: Set<string>; preferredSlot: string | null; balance: number }
  >();

  for (const s of schedules) {
    if (latestByUser.has(s.userId)) continue;
    const raw = s.data as SchedulePayload;
    latestByUser.set(s.userId, {
      blocked: new Set(raw.blocked ?? []),
      preferredSlot: raw.preferredSlot?.trim() || null,
      balance: s.user.balance,
    });
  }

  const participants = Array.from(latestByUser.entries()).map(([userId, v]) => ({
    userId,
    ...v,
  }));

  const blockedByUser = participants.map((p) => p.blocked);
  const common = commonFreeSlots(blockedByUser);
  const allKeys = allSlotKeys();

  let chosen: string;
  let decisionMode: DecisionMode;

  if (common.length > 0) {
    const maxBalance = Math.max(...participants.map((p) => p.balance));

    if (maxBalance === 0) {
      chosen = pickRandom(common);
      decisionMode = "COMMON_RANDOM_ZERO";
    } else {
      const topUsers = participants.filter((p) => p.balance === maxBalance);
      const winner = pickRandom(topUsers);
      if (
        winner.preferredSlot &&
        common.includes(winner.preferredSlot)
      ) {
        chosen = winner.preferredSlot;
        decisionMode = "COMMON_PREFERRED";
      } else {
        chosen = pickRandom(common);
        decisionMode = "COMMON_RANDOM_FALLBACK";
      }
    }
  } else {
    const maxBalance = Math.max(...participants.map((p) => p.balance));
    const topUsers =
      maxBalance === 0
        ? participants
        : participants.filter((p) => p.balance === maxBalance);
    const winner = pickRandom(topUsers);

    let freeForWinner = allKeys.filter((k) => !winner.blocked.has(k));
    if (freeForWinner.length === 0) {
      const unionFree = new Set<string>();
      for (const p of participants) {
        for (const k of allKeys) {
          if (!p.blocked.has(k)) unionFree.add(k);
        }
      }
      freeForWinner = Array.from(unionFree);
    }
    if (freeForWinner.length === 0) {
      return NextResponse.json(
        { error: "빈 시간을 찾을 수 없습니다." },
        { status: 400 },
      );
    }
    chosen = pickRandom(freeForWinner);
    decisionMode = "AUCTION";
  }

  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: {
      confirmedTime: chosen,
      decisionMode,
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({
    status: "confirmed",
    confirmedTime: updatedRoom.confirmedTime,
    decisionMode: updatedRoom.decisionMode,
  });
}
