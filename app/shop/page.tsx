"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  History,
  Info,
  Link as LinkIcon,
  Plus,
  Unlink,
  Wallet,
} from "lucide-react"

interface CurrentUser {
  id: number
  name: string
  balance: number
  kakaoPayLinked?: boolean
}

interface KakaoPayStatus {
  provider: string
  linked: boolean
  linkedAccount: {
    name: string | null
    keyMasked: string | null
    connectedAt: string | null
  } | null
  externalBalanceAvailable: boolean
  internalDepositBalance: number
  note: string
  recentTransactions: Array<{
    id: number
    provider: string
    type: string
    amount: number
    status: string
    description: string | null
    createdAt: string
  }>
}

export default function ShopPage() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<KakaoPayStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkForm, setLinkForm] = useState({ accountName: "", accountKey: "" })
  const [topupAmount, setTopupAmount] = useState("5000")

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser")

    if (!storedUser) {
      setLoading(false)
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser) as CurrentUser
      setUser(parsedUser)
      void fetchStatus(parsedUser.id)
    } catch {
      setError("로그인 정보를 읽을 수 없습니다. 메인 화면에서 다시 로그인해주세요.")
      setLoading(false)
    }
  }, [])

  const fetchStatus = async (userId: number) => {
    setLoading(true)

    try {
      const response = await fetch(`/api/kakaopay?userId=${userId}`)
      const data = (await response.json()) as KakaoPayStatus | { error?: string }

      if (!response.ok) {
        throw new Error("error" in data ? data.error : "카카오페이 상태를 가져오지 못했습니다.")
      }

      setStatus(data as KakaoPayStatus)
      setError(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "카카오페이 상태를 가져오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const syncLocalUser = (nextUser: CurrentUser) => {
    setUser(nextUser)
    localStorage.setItem("currentUser", JSON.stringify(nextUser))
    window.dispatchEvent(new Event("userUpdated"))
  }

  const handleLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const response = await fetch("/api/kakaopay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          accountName: linkForm.accountName,
          accountKey: linkForm.accountKey,
        }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "카카오페이 연동에 실패했습니다.")
      }

      syncLocalUser({ ...user, kakaoPayLinked: true })
      setLinkForm({ accountName: "", accountKey: "" })
      await fetchStatus(user.id)
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "카카오페이 연동에 실패했습니다.")
    } finally {
      setBusy(false)
    }
  }

  const handleUnlink = async () => {
    if (!user) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/kakaopay?userId=${user.id}`, {
        method: "DELETE",
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "카카오페이 연동 해제에 실패했습니다.")
      }

      syncLocalUser({ ...user, kakaoPayLinked: false })
      await fetchStatus(user.id)
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "카카오페이 연동 해제에 실패했습니다.")
    } finally {
      setBusy(false)
    }
  }

  const handleTopup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      return
    }

    const amount = Number(topupAmount)
    if (!Number.isInteger(amount) || amount < 100) {
      setError("충전 금액은 100P 이상 정수만 가능합니다.")
      return
    }

    setBusy(true)
    setError(null)

    try {
      const response = await fetch("/api/kakaopay/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount }),
      })

      const data = (await response.json()) as { balance?: number; error?: string }
      if (!response.ok || typeof data.balance !== "number") {
        throw new Error(data.error ?? "예치금 충전에 실패했습니다.")
      }

      syncLocalUser({ ...user, balance: data.balance, kakaoPayLinked: true })
      await fetchStatus(user.id)
    } catch (topupError) {
      setError(topupError instanceof Error ? topupError.message : "예치금 충전에 실패했습니다.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-20 text-foreground md:pb-0">
      <div className="absolute -left-20 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute right-[-80px] top-1/3 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <Navigation />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
                카카오페이 연동 예치금
              </h1>
              <p className="text-sm font-medium text-muted-foreground">
                실제 잔액 대신 내부 예치금과 충전 기록을 연결해서 관리합니다.
              </p>
            </div>
          </div>

          {user ? (
            <div className="hidden items-center gap-3 rounded-2xl border border-border/50 bg-card/60 px-5 py-3 shadow-xl backdrop-blur md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  현재 예치금
                </p>
                <p className="text-sm font-bold tracking-tight">{user.balance.toLocaleString("ko-KR")}P</p>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Alert className="mb-8 border-[#FEE500]/50 bg-[#FEE500]/10">
          <Info className="h-4 w-4 text-foreground" />
          <AlertTitle>공개 API 제약</AlertTitle>
          <AlertDescription>
            카카오페이 공개 API에는 사용자 머니 잔액 조회가 없어서, 이 화면은 카카오페이 연동 메모와 서비스 내부 예치금만 보여줍니다.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-border/50 bg-card/70 p-8 text-center shadow-xl backdrop-blur">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">연동 상태를 불러오는 중입니다.</p>
          </div>
        ) : !user ? (
          <Card className="border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle>로그인이 필요합니다</CardTitle>
              <CardDescription>메인 화면에서 로그인한 뒤 예치금 연동 상태를 확인할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button>내 시간표에서 로그인하기</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-8">
              <Card className="overflow-hidden border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge className="border-none bg-[#FEE500] text-black hover:bg-[#FEE500]/90">
                          KakaoPay
                        </Badge>
                        연동 상태
                      </CardTitle>
                      <CardDescription className="mt-2">
                        카카오페이 계정을 직접 검증하지는 않고, 연동 메모와 내부 예치금 흐름만 저장합니다.
                      </CardDescription>
                    </div>
                    {status?.linked ? (
                      <Button variant="ghost" size="sm" onClick={handleUnlink} disabled={busy}>
                        <Unlink className="mr-2 h-4 w-4" />
                        연동 해제
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-4 rounded-2xl border border-border/50 bg-background/60 p-5 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">내부 예치금</p>
                      <p className="mt-2 text-4xl font-black tracking-tight text-foreground">
                        {status?.internalDepositBalance.toLocaleString("ko-KR") ?? user.balance.toLocaleString("ko-KR")}P
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">외부 잔액 조회</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {status?.externalBalanceAvailable ? "가능" : "미지원"}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {status?.note ?? "카카오페이 공개 API 제약으로 외부 잔액은 가져오지 않습니다."}
                      </p>
                    </div>
                  </div>

                  {status?.linked ? (
                    <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">연동 메모</p>
                          <p className="text-lg font-semibold text-foreground">
                            {status.linkedAccount?.name ?? "연동 계정"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {status.linkedAccount?.keyMasked ?? "식별 메모 없음"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLink} className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-card/50 p-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <LinkIcon className="h-4 w-4 text-primary" />
                        카카오페이 연동 메모 저장
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="accountName">연동 별칭</Label>
                          <Input
                            id="accountName"
                            value={linkForm.accountName}
                            onChange={(event) =>
                              setLinkForm((current) => ({ ...current, accountName: event.target.value }))
                            }
                            placeholder="예: 내 카카오페이"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountKey">식별 메모</Label>
                          <Input
                            id="accountKey"
                            value={linkForm.accountKey}
                            onChange={(event) =>
                              setLinkForm((current) => ({ ...current, accountKey: event.target.value }))
                            }
                            placeholder="예: 자주 쓰는 계정 1234"
                            required
                          />
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        입력한 식별 메모는 마지막 4자리만 저장합니다. 실제 계좌 검증이나 카카오페이 토큰 발급은 하지 않습니다.
                      </p>
                      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                        {busy ? <Spinner className="mr-2 h-4 w-4" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                        연동 메모 저장
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    내부 예치금 충전
                  </CardTitle>
                  <CardDescription>
                    실제 카카오페이 결제 호출 없이, 현재 연동 상태를 기준으로 서비스 내부 예치금 충전 기록을 남깁니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTopup} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="topupAmount">충전 금액</Label>
                      <div className="relative">
                        <Input
                          id="topupAmount"
                          type="number"
                          min="100"
                          step="100"
                          value={topupAmount}
                          onChange={(event) => setTopupAmount(event.target.value)}
                          className="h-14 pr-14 text-lg font-bold"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">
                          P
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[1000, 5000, 10000, 50000].map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant="outline"
                          onClick={() => setTopupAmount(String(amount))}
                        >
                          +{amount.toLocaleString("ko-KR")}P
                        </Button>
                      ))}
                    </div>

                    <Button type="submit" disabled={busy || !status?.linked} className="h-14 w-full text-base font-bold">
                      {busy ? <Spinner className="mr-2 h-4 w-4" /> : <Wallet className="mr-2 h-4 w-4" />}
                      {Number(topupAmount || 0).toLocaleString("ko-KR")}P 충전 기록 반영
                    </Button>

                    {!status?.linked ? (
                      <p className="text-xs text-muted-foreground">먼저 카카오페이 연동 메모를 저장해야 충전 기록을 남길 수 있습니다.</p>
                    ) : null}
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  최근 카카오페이 연동 기록
                </CardTitle>
                <CardDescription>실제 카카오페이 거래내역이 아니라 서비스 내부 예치금 반영 내역입니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {status?.recentTransactions.length ? (
                  <div className="space-y-3">
                    {status.recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-2xl border border-border/50 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{transaction.type}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(transaction.createdAt).toLocaleString("ko-KR")}
                            </p>
                            {transaction.description ? (
                              <p className="mt-2 text-xs text-muted-foreground/80">{transaction.description}</p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">+{transaction.amount.toLocaleString("ko-KR")}P</p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {transaction.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-background/40 px-6 text-center">
                    <History className="h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-muted-foreground">아직 반영된 카카오페이 연동 충전 기록이 없습니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-14 text-center text-xs text-muted-foreground">
          <p>© 2026 Ddalkkak-ton. KakaoPay-linked deposit records are managed inside this service.</p>
        </div>
      </main>
    </div>
  )
}
