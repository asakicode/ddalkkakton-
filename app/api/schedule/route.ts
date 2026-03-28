import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 저장: POST /api/schedule
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
      { status: 400 },
    );
  }

  const { userId, roomCode, blockedSlots, preferredSlot } = (body ?? {}) as {
    userId?: number;
    roomCode?: string;
    blockedSlots?: string[];
    preferredSlot?: string | null;
  };

  if (!userId || !Array.isArray(blockedSlots)) {
    return NextResponse.json({ error: "userId와 blockedSlots가 필요합니다." }, { status: 400 });
  }

  let roomId: number | null = null;
  if (roomCode) {
    const room = await prisma.room.findUnique({ where: { code: roomCode } });
    roomId = room?.id ?? null;
  }

  const pref =
    typeof preferredSlot === "string" && preferredSlot.trim()
      ? preferredSlot.trim()
      : null;

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      roomId: roomId ?? undefined,
      data: { blocked: blockedSlots, preferredSlot: pref },
    },
  });

  return NextResponse.json({ id: schedule.id });
}

