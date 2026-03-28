import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 불참/노쇼 페널티: POST /api/penalty
export async function POST(req: NextRequest) {
  const { roomCode, userId } = await req.json();
  const PENALTY = 50000;
  const normalizedRoomCode = String(roomCode ?? "").trim().toUpperCase();

  if (!normalizedRoomCode || !userId) {
    return NextResponse.json({ error: "roomCode와 userId가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code: normalizedRoomCode },
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

  const participantIds = schedules.map((s: { userId: number }) => s.userId);
  const receivers = participantIds.filter((id: number) => id !== userId);

  if (receivers.length === 0) {
    const [, , updated] = await prisma.$transaction([
      prisma.roomBid.deleteMany({
        where: { roomId: room.id, userId },
      }),
      prisma.schedule.updateMany({
        where: { roomId: room.id, userId },
        data: { roomId: null },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: PENALTY } },
      }),
    ]);

    return NextResponse.json({
      balance: updated.balance,
      leftRoom: true,
    });
  }

  const share = Math.floor(PENALTY / receivers.length);

  const [, , , , updatedUser] = await prisma.$transaction([
    prisma.roomBid.deleteMany({
      where: { roomId: room.id, userId },
    }),
    prisma.schedule.updateMany({
      where: { roomId: room.id, userId },
      data: { roomId: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: PENALTY } },
    }),
    prisma.user.updateMany({
      where: { id: { in: receivers } },
        data: { balance: { increment: share } },
      }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  return NextResponse.json({
    balance: updatedUser.balance,
    distributed: share,
    leftRoom: true,
  });
}

