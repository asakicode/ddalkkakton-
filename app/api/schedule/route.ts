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

  const parsed = (body ?? {}) as {
    bidOnly?: boolean;
    userId?: number;
    roomCode?: string;
    blockedSlots?: string[];
    bidSlot?: string | null;
    bidAmount?: number;
    preferredSlot?: string | null;
  };

  const { bidOnly, userId, roomCode } = parsed;

  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  if (bidOnly) {
    const code = (roomCode ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "roomCode가 필요합니다." }, { status: 400 });
    }

    const room = await prisma.room.findUnique({ where: { code } });
    if (!room) {
      return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
    }

    const latest = await prisma.schedule.findFirst({
      where: { userId, roomId: room.id },
      orderBy: { submittedAt: "desc" },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "이 방에 제출된 시간표가 없습니다. 먼저 시간표를 저장하세요." },
        { status: 400 },
      );
    }

    const prev = latest.data as ScheduleData;
    const bidSlot =
      typeof parsed.bidSlot === "string" && parsed.bidSlot.trim()
        ? parsed.bidSlot.trim()
        : null;
    const bidAmount = parseBidAmount(parsed.bidAmount);

    await prisma.schedule.update({
      where: { id: latest.id },
      data: {
        data: {
          ...prev,
          blocked: prev.blocked ?? [],
          bidSlot,
          bidAmount,
        } as object,
      },
    });

    return NextResponse.json({ ok: true, bidSlot, bidAmount });
  }

  const { blockedSlots } = parsed;
  if (!Array.isArray(blockedSlots)) {
    return NextResponse.json({ error: "blockedSlots가 필요합니다." }, { status: 400 });
  }

  let roomId: number | null = null;
  if (roomCode) {
    const trimmed = roomCode.trim();
    const room = await prisma.room.findUnique({ where: { code: trimmed } });
    roomId = room?.id ?? null;
  }

  const pref =
    typeof parsed.preferredSlot === "string" && parsed.preferredSlot.trim()
      ? parsed.preferredSlot.trim()
      : null;

  const bidSlot =
    typeof parsed.bidSlot === "string" && parsed.bidSlot.trim()
      ? parsed.bidSlot.trim()
      : null;
  const bidAmount = parseBidAmount(parsed.bidAmount);

  const schedule = await prisma.schedule.create({
    data: {
      userId,
      roomId: roomId ?? undefined,
      data: {
        blocked: blockedSlots,
        preferredSlot: pref,
        bidSlot,
        bidAmount,
      } as object,
    },
  });

  return NextResponse.json({ id: schedule.id });
}
