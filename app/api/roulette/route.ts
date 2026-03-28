import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

// 강제 시간 확정: POST /api/roulette
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

  const schedules = await prisma.schedule.findMany({
    where: { roomId: room.id },
  });

  if (schedules.length === 0) {
    return NextResponse.json({ error: "제출된 시간표가 없습니다." }, { status: 400 });
  }

  // 각 유저의 blockedSlots를 집합으로 변환
  const blockedByUser = schedules.map((s) => {
    const blocked = (s.data as any).blocked as string[] | undefined;
    return new Set(blocked ?? []);
  });

  const commonFreeSlots: string[] = [];

  for (const day of DAYS) {
    for (const time of HOURS) {
      const key = `${day}-${time}`;
      const allFree = blockedByUser.every((set) => !set.has(key));
      if (allFree) {
        commonFreeSlots.push(key);
      }
    }
  }

  if (commonFreeSlots.length === 0) {
    return NextResponse.json({ status: "no-common" });
  }

  const randomIndex = Math.floor(Math.random() * commonFreeSlots.length);
  const chosen = commonFreeSlots[randomIndex];

  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: {
      confirmedSlot: chosen,
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({
    status: "confirmed",
    confirmedSlot: updatedRoom.confirmedSlot,
  });
}

