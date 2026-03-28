"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ScheduleGrid } from "@/components/schedule/schedule-grid"
import { DepositDisplay } from "@/components/schedule/deposit-display"
import { Button } from "@/components/ui/button"
import { Shield, Save, AlertTriangle } from "lucide-react"

interface CurrentUser {
  id: number
  name: string
  balance: number
}

export default function MySchedulePage() {
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set())
  const [isSaved, setIsSaved] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [authForm, setAuthForm] = useState({ name: "", password: "" })
  const [authError, setAuthError] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string>("")
  const [preferredSlot, setPreferredSlot] = useState<string>("")

  useEffect(() => {
    const stored = localStorage.getItem("currentUser")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CurrentUser
        setUser(parsed)
      } catch {
        // ignore
      }
    }

    const storedRoomCode = localStorage.getItem("currentRoomCode")
    if (storedRoomCode) {
      setRoomCode(storedRoomCode)
    }
  }, [])

  const handleLogin = async () => {
    setAuthError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "로그인 실패")
      }
      const data = (await res.json()) as CurrentUser
      setUser(data)
      localStorage.setItem("currentUser", JSON.stringify(data))
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "로그인 중 오류 발생")
    }
  }

  const handleSave = () => {
    if (!user) {
      setAuthError("먼저 로그인해주세요.")
      return
    }

    const blocked = Array.from(blockedSlots)

    fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        roomCode: roomCode.trim() || undefined,
        blockedSlots: blocked,
        preferredSlot: preferredSlot.trim() || undefined,
      }),
    }).catch(() => {
      // 단순 프로토타입: 에러 메시지는 별도로 처리하지 않음
    })

    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const blockedCount = blockedSlots.size

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navigation />
      
      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">내 시간표 설정</h1>
            <p className="text-sm text-muted-foreground">
              수업/알바 등 불가능한 시간을 드래그하여 선택하세요
            </p>
          </div>
        </div>

        {/* Login / User Info */}
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          {user ? (
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-sm text-muted-foreground">현재 로그인</p>
                <p className="text-base font-semibold text-foreground">
                  {user.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  placeholder="방 코드"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => localStorage.setItem("currentRoomCode", roomCode)}
                >
                  방 코드 저장
                </Button>
              </div>
              <input
                className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                placeholder="지망 시간 (선택, 예: 금-14:00) — 공통 시간 안에서만 반영"
                value={preferredSlot}
                onChange={(e) => setPreferredSlot(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                시간표 저장 시 이 방 코드로 제출됩니다. 예치금 경매 시 지망은 공통 가능 시간 안에서만
                적용됩니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="이름"
                  value={authForm.name}
                  onChange={(e) =>
                    setAuthForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="비밀번호"
                  type="password"
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
                <Button onClick={handleLogin} className="shrink-0">
                  로그인
                </Button>
              </div>
              {authError && (
                <p className="text-xs text-destructive">{authError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                처음 로그인하면 자동으로 100,000P가 예치됩니다.
              </p>
            </div>
          )}
        </div>

        {/* Deposit Display */}
        <div className="mb-6">
          <DepositDisplay amount={user?.balance ?? 0} />
        </div>

        {/* Warning Banner */}
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            <strong>경고:</strong> 설정한 시간 외에는 팀플 일정이 강제 배정될 수 있습니다. 
            신중하게 설정하세요.
          </p>
        </div>

        {/* Legend */}
        <div className="mb-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-card border border-border" />
            <span className="text-muted-foreground">가능한 시간</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-destructive/80" />
            <span className="text-muted-foreground">불가능한 시간 (수업/알바 등)</span>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="mb-6 rounded-lg border border-border bg-card/50 p-2">
          <div className="h-[500px] overflow-auto">
            <ScheduleGrid 
              blockedSlots={blockedSlots} 
              onSlotsChange={setBlockedSlots} 
            />
          </div>
        </div>

        {/* Stats & Save */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{blockedCount}</p>
              <p className="text-xs text-muted-foreground">제외된 슬롯</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{336 - blockedCount}</p>
              <p className="text-xs text-muted-foreground">가능한 슬롯</p>
            </div>
          </div>
          
          <Button 
            onClick={handleSave}
            className={cn(
              "gap-2",
              isSaved && "bg-success text-success-foreground hover:bg-success"
            )}
            size="lg"
          >
            <Save className="h-4 w-4" />
            {isSaved ? "저장 완료!" : "시간표 저장"}
          </Button>
        </div>
      </main>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
