import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Params {
  // Next 버전에 따라 params가 Promise로 올 수 있어 방어적으로 처리
  params: { code: string } | Promise<{ code: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const resolvedParams = await Promise.resolve(params as any);
  const code = ((resolvedParams?.code as string | undefined) ?? "").trim();
  const normalized = code.toUpperCase();

  if (!normalized) {
    return NextResponse.json({ error: "방 코드가 필요합니다." }, { status: 400 });
  }
  const room = await prisma.room.findUnique({
    where: { code: normalized },
    include: {
      schedules: {
        select: { userId: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }

  const submittedUserIds = new Set(room.schedules.map((s) => s.userId));
  const submittedCount = submittedUserIds.size;
  const result = room.confirmedSlot;

  let status: "waiting" | "ready" | "completed";
  if (result) {
    status = "completed";
  } else if (submittedCount >= room.capacity) {
    status = "ready";
  } else {
    status = "waiting";
  }

  return NextResponse.json({
    code: room.code,
    capacity: room.capacity,
    hostId: room.hostId,
    confirmedSlot: room.confirmedSlot,
    /** 룰렛 확정 시간 (없으면 null). confirmedSlot 과 동일 */
    result,
    submittedCount,
    /** 대기: 인원 미충족 / 준비: 전원 제출·아직 미확정 / 완료: 시간 확정 */
    status,
  });
}

