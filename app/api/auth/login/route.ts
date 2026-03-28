import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        { status: 400 },
      );
    }

    const { name, password } = (body ?? {}) as {
      name?: string;
      password?: string;
    };

    const safeName = (name ?? "").trim();
    const safePassword = (password ?? "").trim();

    if (!safeName || !safePassword) {
      return NextResponse.json(
        { error: "이름과 비밀번호가 필요합니다." },
        { status: 400 },
      );
    }

    // 단순 프로토타입: 같은 이름 + 비밀번호면 같은 유저로 간주
    let user = await prisma.user.findFirst({
      where: { name: safeName, password: safePassword },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: safeName,
          password: safePassword,
          // balance 기본값 100,000P
        },
      });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      balance: user.balance,
      kakaoPayLinked: user.kakaoPayLinked,
    });
  } catch (error) {
    console.error("[auth/login] unexpected error:", error);
    return NextResponse.json(
      { error: "로그인 처리 중 서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

