import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 저장: POST /api/schedule
export async function POST(req: NextRequest) {
  const { userId, roomCode, blockedSlots } = await req.json();

  if (!userId || !Array.isArray(blockedSlots)) {
    return NextResponse.json({ error: "userId와 blockedSlots가 필요합니다." }, { status: 400 });
  }

  let roomId: number | null = null;
  if (roomCode) {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    roomId = room?.id ?? null;
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      roomId: roomId ?? undefined,
      data: { blocked: blockedSlots },
    },
  });

  return NextResponse.json({ id: schedule.id });
}

