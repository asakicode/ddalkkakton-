import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 불참/노쇼 페널티: POST /api/penalty
export async function POST(req: NextRequest) {
  const { roomCode, userId } = await req.json();
  const PENALTY = 50000;

  if (!roomCode || !userId) {
    return NextResponse.json({ error: "roomCode와 userId가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
  });

  if (!room || !room.confirmedTime) {
    return NextResponse.json({ error: "확정된 방을 찾을 수 없습니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자 없음" }, { status: 404 });
  }

  if (user.balance < PENALTY) {
    return NextResponse.json(
      { error: "예치금 부족, 현금 충전 후 파토 가능" },
      { status: 400 },
    );
  }

  // 이 방에서 시간표를 제출한 모든 유저를 "참여자"로 간주
  const schedules = await prisma.schedule.findMany({
    where: { roomId: room.id },
    select: { userId: true },
    distinct: ["userId"],
  });

  const participantIds = schedules.map((s) => s.userId);
  const receivers = participantIds.filter((id) => id !== userId);

  if (receivers.length === 0) {
    // 받을 사람이 없으면 그냥 차감만
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: PENALTY } },
    });
    return NextResponse.json({ balance: updated.balance });
  }

  const share = Math.floor(PENALTY / receivers.length);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: PENALTY } },
    }),
    prisma.user.updateMany({
      where: { id: { in: receivers } },
      data: { balance: { increment: share } },
    }),
  ]);

  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });

  return NextResponse.json({
    balance: updatedUser?.balance ?? 0,
    distributed: share,
  });
}

