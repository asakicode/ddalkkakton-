import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PROVIDER_NOTE =
  "카카오페이 공개 API에서는 실제 머니 잔액 조회를 지원하지 않아, 연결 상태와 내부 예치금만 제공합니다.";

function maskAccountKey(accountKey: string | null) {
  if (!accountKey) {
    return null;
  }

  if (accountKey.length <= 4) {
    return `끝 ${accountKey}`;
  }

  return `끝 ${accountKey.slice(-4)}`;
}

function parseUserId(value: string | null) {
  const id = Number(value);
  if (!value || Number.isNaN(id) || id <= 0) {
    return null;
  }

  return id;
}

export async function GET(req: NextRequest) {
  const userId = parseUserId(req.nextUrl.searchParams.get("userId"));

  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      depositTransactions: {
        where: {
          provider: "KAKAOPAY",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    provider: "KakaoPay",
    linked: user.kakaoPayLinked,
    linkedAccount: user.kakaoPayLinked
      ? {
          name: user.kakaoPayAccountName,
          keyMasked: maskAccountKey(user.kakaoPayAccountKey),
          connectedAt: user.kakaoPayConnectedAt,
        }
      : null,
    externalBalanceAvailable: false,
    internalDepositBalance: user.balance,
    note: PROVIDER_NOTE,
    recentTransactions: user.depositTransactions.map((transaction: {
      id: number;
      provider: string;
      type: string;
      amount: number;
      status: string;
      description: string | null;
      createdAt: Date;
    }) => ({
      id: transaction.id,
      provider: transaction.provider,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      description: transaction.description,
      createdAt: transaction.createdAt,
    })),
  });
}

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

  const { userId, accountName, accountKey } = (body ?? {}) as {
    userId?: number;
    accountName?: string;
    accountKey?: string;
  };

  const normalizedName = (accountName ?? "").trim();
  const normalizedKey = (accountKey ?? "").trim();

  if (!userId || !normalizedName || !normalizedKey) {
    return NextResponse.json(
      { error: "userId, accountName, accountKey가 필요합니다." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      kakaoPayLinked: true,
      kakaoPayAccountName: normalizedName,
      kakaoPayAccountKey: normalizedKey.slice(-4),
      kakaoPayConnectedAt: new Date(),
    },
  });

  return NextResponse.json({
    linked: updatedUser.kakaoPayLinked,
    linkedAccount: {
      name: updatedUser.kakaoPayAccountName,
      keyMasked: maskAccountKey(updatedUser.kakaoPayAccountKey),
      connectedAt: updatedUser.kakaoPayConnectedAt,
    },
    note: PROVIDER_NOTE,
  });
}

export async function DELETE(req: NextRequest) {
  const userId = parseUserId(req.nextUrl.searchParams.get("userId"));

  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      kakaoPayLinked: false,
      kakaoPayAccountName: null,
      kakaoPayAccountKey: null,
      kakaoPayConnectedAt: null,
    },
  });

  return NextResponse.json({ linked: false });
}
