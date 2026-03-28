import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 시간 확정은 실시간 경매 API(/api/room/[code]/auction/*)에서만 처리합니다. */
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

  const room = await prisma.room.findUnique({ where: { code } });
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

  return NextResponse.json(
    {
      error:
        "룰렛 페이지에서 '실시간 예치금 경매 시작' 후 후보별로 배팅·확정해 주세요.",
    },
    { status: 400 },
  );
}
