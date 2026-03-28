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

  return NextResponse.json({
    code: room.code,
    capacity: room.capacity,
    hostId: room.hostId,
    confirmedSlot: room.confirmedSlot,
    submittedCount: submittedUserIds.size,
  });
}

