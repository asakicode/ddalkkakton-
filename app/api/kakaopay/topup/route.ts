import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const { userId, amount } = (body ?? {}) as {
    userId?: number;
    amount?: number;
  };

  if (!userId || !amount) {
    return NextResponse.json({ error: "userId와 amount가 필요합니다." }, { status: 400 });
  }

  if (!Number.isInteger(amount) || amount < 100) {
    return NextResponse.json({ error: "amount는 100P 이상의 정수여야 합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!user.kakaoPayLinked) {
    return NextResponse.json(
      { error: "먼저 카카오페이 계정을 연결해주세요." },
      { status: 400 },
    );
  }

  const [, updatedUser] = await prisma.$transaction([
    prisma.depositTransaction.create({
      data: {
        userId,
        provider: "KAKAOPAY",
        type: "TOP_UP",
        amount,
        status: "RECORDED",
        description: "카카오페이 연동 예치금 충전 반영",
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: amount,
        },
      },
    }),
  ]);

  return NextResponse.json({
    balance: updatedUser.balance,
    creditedAmount: amount,
    message:
      "카카오페이 공개 API에서는 실제 잔액 조회를 지원하지 않아 내부 예치금에 충전 내역을 반영했습니다.",
  });
}
