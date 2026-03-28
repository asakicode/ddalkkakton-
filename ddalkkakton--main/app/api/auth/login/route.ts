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

  const {
    mode,
    email,
    username,
    name,
    password,
  } = (body ?? {}) as {
    mode?: string;
    email?: string;
    username?: string;
    name?: string;
    password?: string;
  };

  const safeMode = (mode ?? "").trim();
  const safeEmail = (email ?? "").trim().toLowerCase();
  const safeUsername = (username ?? "").trim();
  const safeName = (name ?? "").trim();
  const safePassword = (password ?? "").trim();

  if (safeMode === "register") {
    if (!safeEmail || !safeUsername || !safeName || !safePassword) {
      return NextResponse.json(
        { error: "이메일, 아이디, 이름, 비밀번호가 모두 필요합니다." },
        { status: 400 },
      );
    }

    if (!safeEmail.includes("@") || safeEmail.length < 5) {
      return NextResponse.json(
        { error: "유효한 이메일 주소를 입력하세요." },
        { status: 400 },
      );
    }

    if (safePassword.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 최소 8자 이상이어야 합니다." },
        { status: 400 },
      );
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: safeEmail } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 400 },
      );
    }
    const existingUsername = await prisma.user.findUnique({ where: { username: safeUsername } });
    if (existingUsername) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email: safeEmail,
        username: safeUsername,
        name: safeName,
        password: safePassword,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      balance: user.balance,
    });
  }

  if (safeMode === "login") {
    if (!safeUsername || !safePassword) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력하세요." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username: safeUsername } });
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.password !== safePassword) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      balance: user.balance,
    });
  }

  return NextResponse.json({ error: "요청된 모드를 지원하지 않습니다." }, { status: 400 });
}

