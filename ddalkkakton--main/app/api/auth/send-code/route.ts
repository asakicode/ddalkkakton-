import { NextRequest, NextResponse } from 'next/server';
import { sendVerificationCodeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 6자리 랜덤 코드 생성
    const verificationCode = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    // 이메일 발송
    const result = await sendVerificationCodeEmail(email, verificationCode);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    // 클라이언트에게는 코드를 보내지 않음 (이메일로만 전송)
    return NextResponse.json({
      success: true,
      message: result.message,
      code: verificationCode, // 테스트용: 개발 중에만 사용, 나중에 제거
    });
  } catch (error) {
    console.error('인증코드 발송 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
