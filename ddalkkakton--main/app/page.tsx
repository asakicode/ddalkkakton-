"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ScheduleGrid } from "@/components/schedule/schedule-grid"
import { DepositDisplay } from "@/components/schedule/deposit-display"
import { Button } from "@/components/ui/button"
import { Shield, Save, AlertTriangle, UserPlus, LogIn } from "lucide-react"

interface CurrentUser {
  id: number
  name: string
  username: string
  email: string
  balance: number
}

type AuthMode = "login" | "register" | "none"

export default function MySchedulePage() {
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set())
  const [isSaved, setIsSaved] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [roomCode, setRoomCode] = useState<string>("")

  const [authMode, setAuthMode] = useState<AuthMode>("none")
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)

  const [authForm, setAuthForm] = useState({
    email: "",
    username: "",
    name: "",
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    const stored = localStorage.getItem("currentUser")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CurrentUser
        setUser(parsed)
      } catch {
      }
    }
    const storedRoomCode = localStorage.getItem("currentRoomCode")
    if (storedRoomCode) {
      setRoomCode(storedRoomCode)
    }
  }, [])



  const login = async () => {
    setAuthError(null)
    setAuthMessage(null)
    if (!authForm.username || !authForm.password) {
      setAuthError("아이디와 비밀번호를 모두 입력해주세요.")
      return
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "login",
        username: authForm.username,
        password: authForm.password,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setAuthError(data.error || "로그인에 실패했습니다.")
      return
    }

    const data = (await res.json()) as CurrentUser
    setUser(data)
    localStorage.setItem("currentUser", JSON.stringify(data))
    setAuthMode("none")
    setAuthMessage("로그인에 성공했습니다.")
  }

  const register = async () => {
    setAuthError(null)
    setAuthMessage(null)
    const { email, username, name, password, confirmPassword } = authForm
    if (!email || !username || !name || !password || !confirmPassword) {
      setAuthError("모든 항목을 입력해주세요.")
      return
    }
    if (!email.includes("@")) {
      setAuthError("유효한 이메일을 입력해주세요.")
      return
    }
    if (password.length < 8) {
      setAuthError("비밀번호는 최소 8자 이상이어야 합니다.")
      return
    }
    if (password !== confirmPassword) {
      setAuthError("비밀번호가 일치하지 않습니다.")
      return
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "register",
        email,
        username,
        name,
        password,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setAuthError(data.error || "Registration failed.")
      return
    }

    const data = (await res.json()) as CurrentUser
    setUser(data)
    localStorage.setItem("currentUser", JSON.stringify(data))
    setAuthMode("none")
    setAuthMessage("회원가입 및 로그인에 성공했습니다.")
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem("currentUser")
  }

  const handleSave = () => {
    if (!user) {
      setAuthError("Please login first.")
      return
    }
    const blocked = Array.from(blockedSlots)
    fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, roomCode: roomCode || undefined, blockedSlots: blocked }),
    }).catch(() => {})
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const blockedCount = blockedSlots.size

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">내 시간표 설정</h1>
            <p className="text-sm text-muted-foreground">수업/알바 등 불가능한 시간을 선택하고 저장하세요.</p>
          </div>
          <div className="flex gap-2">
            {user ? (
              <>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{user.username} ({user.email})</p>
                  <p>{user.name}님, 환영합니다.</p>
                </div>
                <Button onClick={handleLogout} variant="outline">로그아웃</Button>
              </>
            ) : (
              <>
                <Button onClick={() => { setAuthError(null); setAuthMessage(null); setAuthMode("login") }} variant="outline" className="flex items-center gap-1"><LogIn className="h-4 w-4" /> 로그인</Button>
                <Button onClick={() => { setAuthError(null); setAuthMessage(null); setAuthMode("register") }} className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> 회원가입</Button>
              </>
            )}
          </div>
        </div>

        {authMode !== "none" && !user && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">{authMode === "login" ? "로그인" : "회원가입"}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {authMode === "register" && <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="이메일" value={authForm.email} onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))} />}
              <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder={authMode === "login" ? "아이디" : "아이디"} value={authForm.username} onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))} />
              {authMode === "register" && <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="이름" value={authForm.name} onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))} />}
              <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="비밀번호" type="password" value={authForm.password} onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))} />
              {authMode === "register" && <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="비밀번호 확인" type="password" value={authForm.confirmPassword} onChange={(e) => setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />}
            </div>
            {authError && <p className="mt-3 text-xs text-destructive">{authError}</p>}
            {authMessage && <p className="mt-3 text-xs text-success">{authMessage}</p>}
            <div className="mt-4">
              {authMode === "login" ? <Button onClick={login}>로그인</Button> : <Button onClick={register}>회원가입</Button>}
            </div>
          </div>
        )}

        {user && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">현재 로그인 사용자</p>
            <p className="text-base font-semibold">{user.name} ({user.username})</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}

        <div className="mb-6">
          <DepositDisplay amount={user?.balance ?? 0} />
        </div>

        <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive"><strong>경고:</strong> 입력한 시간은 실제로 확정될 수 있습니다. 신중히 선택하세요.</p>
        </div>

        <div className="mb-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded bg-card border border-border" /><span className="text-muted-foreground">가능</span></div>
          <div className="flex items-center gap-2"><div className="h-4 w-4 rounded bg-destructive/80" /><span className="text-muted-foreground">불가능</span></div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card/50 p-2">
          <div className="h-[500px] overflow-auto">
            <ScheduleGrid blockedSlots={blockedSlots} onSlotsChange={setBlockedSlots} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="text-center"><p className="text-2xl font-bold text-foreground">{blockedCount}</p><p className="text-xs text-muted-foreground">제외된 슬롯</p></div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center"><p className="text-2xl font-bold text-success">{336 - blockedCount}</p><p className="text-xs text-muted-foreground">가능한 슬롯</p></div>
          </div>
          <Button onClick={handleSave} className={cn("gap-2", isSaved && "bg-success text-success-foreground hover:bg-success")} size="lg">
            <Save className="h-4 w-4" /> {isSaved ? "저장됐습니다" : "시간표 저장"}
          </Button>
        </div>
      </main>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
