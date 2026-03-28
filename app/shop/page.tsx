"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Wallet, CreditCard, ShieldCheck, Info } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ShopPage() {
  return (
    <div className="relative min-h-screen pb-20 md:pb-0 bg-background text-foreground overflow-hidden">
      <div className="absolute -top-24 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute top-1/2 -right-20 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <Navigation />

      <main className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">포인트샵</h1>
              <p className="text-sm text-muted-foreground font-medium">시간을 벌기 위해 포인트를 충전하세요</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 rounded-2xl bg-card/50 backdrop-blur-md px-5 py-2.5 border border-border/50 shadow-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1 text-center">현재 잔액</span>
              <span className="text-sm font-bold tracking-tight">100,000P</span>
            </div>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <div className="flex flex-col gap-8">
            <div className="rounded-3xl border border-border/50 bg-card/80 backdrop-blur-xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <ShieldCheck className="h-24 w-24" />
              </div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/20 mb-6">
                  <CreditCard className="h-3 w-3" />
                  간편 결제 (충전 전용)
                </div>

                <h2 className="text-xl font-bold mb-6">결제 정보 요약</h2>

                <div className="space-y-6">
                  <div className="flex justify-between items-end pb-4 border-b border-border/30">
                    <span className="text-muted-foreground font-medium">충전 금액</span>
                    <div className="text-right">
                      <span className="text-3xl font-black text-primary">100</span>
                      <span className="ml-1 text-lg font-bold">원</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b border-border/30">
                    <span className="text-muted-foreground font-medium">받는 사람</span>
                    <span className="text-lg font-bold">태현</span>
                  </div>
                  <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 mt-4 text-sm text-muted-foreground leading-relaxed flex gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Info className="h-3 w-3 text-primary" />
                    </div>
                    <p className="font-medium">
                      이 QR 코드를 카카오톡/카카오페이 앱으로 스캔하여 결제 시 포인트가 실시간 자동 충전됩니다.
                    </p>
                  </div>
                </div>

                <Button className="w-full mt-10 h-14 text-lg font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.01] active:scale-[0.98] transition-all bg-gradient-to-r from-primary to-accent border-none text-primary-foreground">
                  결제 완료 확인 (자동 충전 중)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-6 text-center hover:bg-card/80 transition-all border-dashed">
                <p className="text-3xl font-black text-foreground group-hover:scale-110 transition-transform">100P</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">회복 포인트</p>
              </div>
              <div className="group rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-6 text-center hover:bg-card/80 transition-all border-dashed">
                <p className="text-3xl font-black text-primary group-hover:scale-110 transition-transform">+5%</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">보너스 적립</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="group relative w-full max-w-[420px] aspect-[4/5.5] rounded-[3rem] bg-white overflow-hidden shadow-[0_40px_100px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 hover:scale-[1.02]">
              <div className="absolute inset-0 bg-white" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-2xl bg-black/5 z-20" />

              <div className="relative h-full w-full flex flex-col p-8">
                <Image
                  src="/assets/qr_payment.png"
                  alt="Payment QR Kakao"
                  fill
                  className="object-contain p-10"
                  priority
                />
              </div>

              <div className="absolute inset-x-0 top-0 h-[40%] bg-white/10 opacity-30 pointer-events-none -rotate-12 translate-y-[-20%] translate-x-1/2" />

              <div className="absolute inset-0 border-[12px] border-black/5 rounded-[3.2rem] pointer-events-none" />
            </div>

            <p className="mt-8 text-sm font-bold text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              스캔 대기 중... 모바일 앱에서 QR코드를 사용하세요.
            </p>
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-muted-foreground">
          <p>© 2026 Ddalkkak-ton. All payments are securely processed via Kakao Pay.</p>
          <div className="mt-4 flex justify-center gap-6">
            <a href="#" className="hover:text-primary transition-colors">이용약관</a>
            <a href="#" className="hover:text-primary transition-colors">고객센터</a>
          </div>
        </div>
      </main>
    </div>
  )
}
