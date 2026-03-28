import nodemailer from 'nodemailer';

// 개발용 Ethereal Email 설정 (실제 이메일 발송)
// 실제 이메일 서비스로 변경하려면 .env에서 설정 수정
const getTransporter = async () => {
  // Ethereal Email 테스트 계정 (개발용)
  const testAccount = await nodemailer.createTestAccount();
  
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

// 상대적으로 간단한 방식: 콘솔에 코드 출력 + 실제 발송
// 프로덕션에서는 실제 이메일 서비스 사용
export const sendVerificationCodeEmail = async (
  email: string,
  code: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const transporter = await getTransporter();
    
    const info = await transporter.sendMail({
      from: '"딸깍톤 팀" <noreply@ddalkkakton.com>',
      to: email,
      subject: '딸깍톤 - 이메일 인증 코드',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">이메일 인증</h2>
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
              아래의 인증코드를 이메일 입력창 하단의 "인증코드" 필드에 입력해주세요.
            </p>
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <p style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; margin: 0;">
                ${code}
              </p>
            </div>
            <p style="color: #999; font-size: 14px;">
              이 코드는 10분 동안 유효합니다. 요청하지 않았다면 이 이메일을 무시하세요.
            </p>
          </div>
        </div>
      `,
    });
    
    // 개발용으로 이메일 미리보기 URL 출력
    console.log('='.repeat(50));
    console.log(`✉️ 인증코드가 발송되었습니다`);
    console.log(`📧 받는 사람: ${email}`);
    console.log(`🔐 인증코드: ${code}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`👁️ 미리보기: ${nodemailer.getTestMessageUrl(info)}`);
    }
    console.log('='.repeat(50));
    
    return {
      success: true,
      message: '인증코드가 이메일로 발송되었습니다. 메일함을 확인해주세요.',
    };
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    return {
      success: false,
      message: '이메일 발송에 실패했습니다. 나중에 다시 시도해주세요.',
    };
  }
};
