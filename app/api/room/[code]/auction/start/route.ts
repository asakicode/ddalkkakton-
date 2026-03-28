import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCandidateSlots } from "@/lib/room-schedule-helpers";

type Params = { params: { code: string } | Promise<{ code: string }> };

export async function POST(_req: NextRequest, ctx: Params) {
  const { code: raw } = await Promise.resolve(ctx.params as { code: string });
  const code = raw.trim();
  if (!code) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code },
    include: { schedules: { select: { userId: true } } },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  if (room.confirmedTime) {
    return NextResponse.json({ error: "이미 시간이 확정된 방입니다." }, { status: 400 });
  }

  const submitted = new Set(room.schedules.map((s) => s.userId));
  if (submitted.size < room.capacity) {
    return NextResponse.json(
      { error: "아직 모든 인원이 시간표를 제출하지 않았습니다." },
      { status: 400 },
    );
  }

  const candidateSlots = await computeCandidateSlots(prisma, room.id);
  if (candidateSlots.length === 0) {
    return NextResponse.json(
      {
        error:
          "전원 공통으로 가능한 시간이 없습니다. 시간표를 조정한 뒤 다시 제출해주세요.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.roomBid.deleteMany({ where: { roomId: room.id } });
    return tx.room.update({
      where: { id: room.id },
      data: { auctionStartedAt: new Date() },
    });
  });

  return NextResponse.json({
    ok: true,
    candidateSlots,
    auctionStartedAt: updated.auctionStartedAt?.toISOString() ?? null,
  });
}
