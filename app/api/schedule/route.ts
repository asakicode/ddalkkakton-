import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ScheduleData = {
  blocked: string[];
  bidSlot?: string | null;
  bidAmount?: number;
  preferredSlot?: string | null;
};

function parseBidAmount(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

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

  const { userId, roomCode, blockedSlots, preferredSlot, bidAmount } = (body ?? {}) as {
    userId?: number;
    roomCode?: string;
    blockedSlots?: string[];
    preferredSlot?: string | null;
    bidAmount?: number;
  };

  if (!userId || !Array.isArray(blockedSlots)) {
    return NextResponse.json({ error: "userId와 blockedSlots가 필요합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  let roomId: number | null = null;
  if (roomCode) {
    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const room = await prisma.room.findUnique({ where: { code: normalizedRoomCode } });
    if (room?.confirmedTime) {
      return NextResponse.json(
        { error: "이미 시간이 확정된 방입니다." },
        { status: 409 },
      );
    }
    roomId = room?.id ?? null;
  }

  const pref =
    typeof preferredSlot === "string" && preferredSlot.trim()
      ? preferredSlot.trim()
      : null;

  const normalizedBid = Number.isFinite(Number(bidAmount))
    ? Math.floor(Number(bidAmount))
    : 0;

  if (normalizedBid < 0) {
    return NextResponse.json({ error: "배팅 금액은 0 이상이어야 합니다." }, { status: 400 });
  }

  if (pref && blockedSlots.includes(pref)) {
    return NextResponse.json(
      { error: "지망 시간은 불가능한 시간으로 선택할 수 없습니다." },
      { status: 400 },
    );
  }

  if (normalizedBid > 0 && !pref) {
    return NextResponse.json(
      { error: "배팅하려면 지망 시간을 함께 선택해야 합니다." },
      { status: 400 },
    );
  }

  if (normalizedBid > user.balance) {
    return NextResponse.json(
      {
        error: "현재 예치금보다 많이 배팅할 수 없습니다.",
        balance: user.balance,
      },
      { status: 400 },
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      roomId: roomId ?? undefined,
      data: { blocked: blockedSlots, preferredSlot: pref, bidAmount: normalizedBid },
    },
  });

  return NextResponse.json({ id: schedule.id, bidAmount: normalizedBid });
}
