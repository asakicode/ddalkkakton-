import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 방 생성: POST /api/room
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

  const { hostId, capacity, code } = (body ?? {}) as {
    hostId?: number;
    capacity?: number;
    code?: string;
  };

  if (!hostId || !capacity) {
    return NextResponse.json({ error: "hostId와 capacity가 필요합니다." }, { status: 400 });
  }

  const normalizedCode = (code ?? "").trim().toUpperCase();
  const finalCode =
    normalizedCode ||
    Math.random().toString(36).substring(2, 8).toUpperCase();

  if (finalCode.length > 32) {
    return NextResponse.json(
      { error: "방 코드는 32자 이하여야 합니다." },
      { status: 400 },
    );
  }

  try {
    const room = await prisma.room.create({
      data: {
        code: finalCode,
        capacity,
        hostId,
      },
    });

    return NextResponse.json({
      id: room.id,
      code: room.code,
      capacity: room.capacity,
    });
  } catch (e) {
    // unique constraint 등
    return NextResponse.json(
      { error: "방 생성에 실패했습니다. (이미 존재하는 코드일 수 있어요)" },
      { status: 400 },
    );
  }
}

