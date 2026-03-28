"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, AlertTriangle, Lock, Calendar, Skull, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";
import { decisionModeLabel } from "@/lib/decision-mode-label";
import { formatSlotLabel } from "@/lib/candidate-slots";

type Phase = "pre" | "bidding" | "locked";

interface CurrentUser {
  id: number;
  name: string;
  balance: number;
}

interface RoomStatus {
  code: string;
  capacity: number;
  submittedCount: number;
  confirmedTime: string | null;
  confirmedSlot: string | null;
  decisionMode: string | null;
  auctionStartedAt: string | null;
  result: string | null;
  status: "waiting" | "ready" | "completed";
  auctionWinnerId?: number | null;
  auctionWinningBid?: number | null;
  leadingBid?: number | null;
  candidateSlots?: string[];
  auctionReadyCount?: number;
  auctionRequiredCount?: number;
  slotTotals?: Record<string, number>;
  myAuctionBid?: {
    slotKey: string | null;
    bidAmount: number;
    isReady: boolean;
  } | null;
}

const POLL_MS = 1100;

function RoulettePageInner() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("pre");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftBySlot, setDraftBySlot] = useState<Record<string, string>>({});

  const refreshUser = async (id: number) => {
    try {
      const res = await fetch(`/api/user/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem("currentUser", JSON.stringify(data));
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const codeFromQuery = searchParams.get("code");
      const codeFromStorage = localStorage.getItem("currentRoomCode");
      const finalCode = (codeFromQuery ?? codeFromStorage)?.trim();
      if (finalCode) {
        setRoomCode(finalCode);
        localStorage.setItem("currentRoomCode", finalCode);
      }

      const storedUser = localStorage.getItem("currentUser");
      if (storedUser) {
        try {
          setCurrentUser(JSON.parse(storedUser) as CurrentUser);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setMounted(true);
    }
  }, [searchParams]);

  const refreshUserBalance = useCallback(async () => {
    let uid = currentUser?.id;
    if (uid == null) {
      try {
        const raw = localStorage.getItem("currentUser");
        if (raw) uid = (JSON.parse(raw) as CurrentUser).id;
      } catch {
        /* ignore */
      }
    }
    if (uid == null) return;
    const ur = await fetch(`/api/user/${uid}`);
    if (!ur.ok) return;
    const u = (await ur.json()) as CurrentUser;
    localStorage.setItem("currentUser", JSON.stringify(u));
    setCurrentUser(u);
  }, [currentUser?.id]);

  const fetchStatus = useCallback(async () => {
    if (!roomCode) return;
    const uid = currentUser?.id;
    const q = uid != null ? `?userId=${encodeURIComponent(String(uid))}` : "";
    const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}${q}`);
    if (!res.ok) return;
    const data = (await res.json()) as RoomStatus;
    setRoomStatus(data);

    const slot =
      data.result ?? data.confirmedTime ?? data.confirmedSlot ?? null;
    if (slot) {
      setSelectedSlot(slot);
      setPhase("locked");
    } else if (data.auctionStartedAt) {
      setPhase("bidding");
    } else {
      setPhase("pre");
    }
  }, [roomCode, currentUser?.id]);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const previousStatus = roomStatus?.status;
      await fetchStatus();
      if (!cancelled && previousStatus !== "completed" && roomStatus?.status === "completed" && currentUser?.id) {
        void refreshUser(currentUser.id);
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomCode, currentUser?.id, fetchStatus, refreshUser, roomStatus?.status]);

  const canStartAuction = useMemo(() => {
    if (!roomStatus) return false;
    return roomStatus.submittedCount >= roomStatus.capacity;
  }, [roomStatus]);

  const startAuction = async () => {
    if (!roomCode) {
      setError("방 코드가 없습니다.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(
      `/api/room/${encodeURIComponent(roomCode)}/auction/start`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "경매를 시작할 수 없습니다.");
      setBusy(false);
      return;
    }
    await fetchStatus();
    setBusy(false);
  };

  const submitSlotBid = async (slotKey: string) => {
    if (!roomCode || !currentUser) {
      setError("로그인 후 다시 시도해주세요.");
      return;
    }
    const raw = draftBySlot[slotKey] ?? "0";
    const amount = Math.max(0, Math.floor(Number(raw) || 0));
    if (amount > currentUser.balance) {
      setError(`예치금이 부족합니다. (입력 ${amount.toLocaleString()}P)`);
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(
      `/api/room/${encodeURIComponent(roomCode)}/auction/bid`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          slotKey,
          bidAmount: amount,
          confirm: true,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "확정에 실패했습니다.");
      setBusy(false);
      return;
    }

    if (currentUser?.id) {
      refreshUser(currentUser.id);
    }

    if (data.status === "already-confirmed") {
      setSelectedSlot(
        (data.confirmedTime as string) ?? (data.confirmedSlot as string),
      );
      setPhase("locked");
      setBusy(false);
      return;
    }

    await refreshUserBalance();
    await fetchStatus();
    if (data.status === "confirmed" && data.confirmedTime) {
      setSelectedSlot(data.confirmedTime as string);
    }
    setBusy(false);
  };

  const submitAnywhere = async () => {
    if (!roomCode || !currentUser) {
      setError("로그인 후 다시 시도해주세요.");
      return;
    }

    setError(null);
    setBusy(true);
    const res = await fetch(
      `/api/room/${encodeURIComponent(roomCode)}/auction/bid`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          anywhere: true,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "처리에 실패했습니다.");
      setBusy(false);
      return;
    }
    await refreshUserBalance();
    await fetchStatus();
    if (data.status === "confirmed") {
      if (data.confirmedTime) setSelectedSlot(data.confirmedTime);
    }
    setBusy(false);
  };

  const handlePenalty = async () => {
    if (!roomCode || !currentUser) {
      setError("로그인 정보 또는 방 코드가 없습니다.");
      return;
    }
    const res = await fetch("/api/penalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomCode,
        userId: currentUser.id,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "불참 처리 실패");
      return;
    }

    const nextUser = {
      ...currentUser,
      balance: data.balance as number,
    };
    localStorage.setItem("currentUser", JSON.stringify(nextUser));
    setCurrentUser(nextUser);
    localStorage.removeItem("currentRoomCode");
    setRoomCode(null);
    setRoomStatus(null);
    const formatted = new Intl.NumberFormat("ko-KR").format(nextUser.balance);
    alert(`불참 처리 완료: 현재 잔액 ${formatted}P, 방에서 나갔습니다.`);
    window.location.href = "/room";
  };

  const staticHeader = (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
        <Target className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-foreground">실시간 예치금 경매</h1>
        <p className="text-sm text-muted-foreground">
          후보별 확정 배팅 합이 가장 큰 시간이 낙찰됩니다. 전원 0원이면 후보 중 랜덤입니다.
        </p>
      </div>
    </div>
  );

  const candidates = roomStatus?.candidateSlots ?? [];
  const myReady = roomStatus?.myAuctionBid?.isReady ?? false;
  const readyN = roomStatus?.auctionReadyCount ?? 0;
  const needN = roomStatus?.auctionRequiredCount ?? 0;
  const totals = roomStatus?.slotTotals ?? {};

  if (!mounted) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-6">
          {staticHeader}
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navigation />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-8 flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              phase === "locked" ? "bg-destructive/20" : "bg-primary/20",
            )}
          >
            <Target
              className={cn("h-5 w-5", phase === "locked" ? "text-destructive" : "text-primary")}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">실시간 예치금 경매</h1>
            <p className="text-sm text-muted-foreground">
              후보별 확정 배팅 합이 가장 큰 시간이 낙찰됩니다. 전원 0원이면 후보 중 랜덤입니다.
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          방 코드: <span className="font-mono font-semibold text-foreground">{roomCode ?? "-"}</span>{" "}
          / 제출 {roomStatus?.submittedCount ?? 0}/{roomStatus?.capacity ?? "-"}
          {roomStatus?.status && (
            <>
              {" "}
              /{" "}
              <span className="font-medium text-foreground">
                {roomStatus.status === "waiting"
                  ? "대기 중"
                  : roomStatus.status === "ready"
                    ? "준비 완료"
                    : "완료"}
              </span>
            </>
          )}
          {roomStatus?.auctionStartedAt && !roomStatus.confirmedTime && (
            <p className="mt-2 font-medium text-foreground">
              현재 {readyN}/{needN}명 확정 완료
            </p>
          )}
          {roomStatus?.decisionMode && roomStatus.status === "completed" && (
            <p className="mt-1 text-xs">
              확정 방식:{" "}
              <span className="font-medium text-foreground">
                {decisionModeLabel(roomStatus.decisionMode)}
              </span>
            </p>
          )}
        </div>

        <div
          className={cn(
            "relative mb-8 overflow-hidden rounded-2xl border-2 p-6 transition-all",
            phase === "locked" ? "animate-siren border-destructive bg-destructive/10" : "border-border bg-card",
          )}
        >
          {phase === "locked" && selectedSlot && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive animate-pulse">
                <Lock className="h-10 w-10 text-destructive-foreground" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-destructive">낙찰 · 강제 확정</p>
                <div
                  className="text-3xl font-black text-destructive"
                  suppressHydrationWarning
                >
                  {selectedSlot}
                </div>
              </div>

              {roomStatus?.auctionWinningBid != null && roomStatus.auctionWinningBid > 0 && (
                <div className="text-sm font-medium text-warning">
                  낙찰가: {roomStatus.auctionWinningBid.toLocaleString()}P
                  {roomStatus.auctionWinnerId === currentUser?.id
                    ? " (내 입찰 성공, 입찰금 차감 완료)"
                    : ""}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-xl font-bold text-destructive">
                <Skull className="h-6 w-6" />
                탈출 불가
                <Skull className="h-6 w-6" />
              </div>
            </div>
          )}

          {phase !== "locked" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gavel className="h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm">
                  {phase === "pre" && "경매를 시작하면 공통 후보 시간이 열립니다."}
                  {phase === "bidding" &&
                    (busy ? "처리 중…" : "각 시간에 배팅 금액을 입력한 뒤 ‘확정’을 누르세요.")}
                </p>
              </div>

              {phase === "bidding" &&
                roomStatus?.auctionStartedAt &&
                candidates.length > 0 && (
                  <ul className="space-y-3">
                    {candidates.map((key) => (
                      <li
                        key={key}
                        className="flex flex-col gap-2 rounded-lg border border-border bg-background/60 p-3 sm:flex-row sm:items-end sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {formatSlotLabel(key)}
                          </p>
                          {totals[key] != null && totals[key]! > 0 && (
                            <p className="text-xs text-muted-foreground">
                              확정 배팅 합계: {totals[key]!.toLocaleString()}P
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="w-28">
                            <label className="sr-only" htmlFor={`amt-${key}`}>
                              배팅 P
                            </label>
                            <Input
                              id={`amt-${key}`}
                              type="number"
                              min={0}
                              disabled={myReady || busy}
                              value={draftBySlot[key] ?? ""}
                              placeholder="0"
                              className="font-mono"
                              onChange={(e) =>
                                setDraftBySlot((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={myReady || busy || !currentUser}
                            onClick={() => void submitSlotBid(key)}
                          >
                            확정
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

              {phase === "bidding" &&
                roomStatus?.auctionStartedAt &&
                candidates.length === 0 && (
                  <p className="text-sm text-destructive">공통 후보 시간이 없습니다.</p>
                )}
            </div>
          )}
        </div>

        {phase === "bidding" &&
          roomStatus?.auctionStartedAt &&
          !roomStatus.confirmedTime && (
            <div className="mb-6">
              <Button
                variant="outline"
                className="w-full"
                disabled={myReady || busy || !currentUser}
                onClick={() => void submitAnywhere()}
              >
                어디든 상관없음 (0원 · 즉시 확정)
              </Button>
            </div>
          )}

        <div
          className={cn(
            "mb-6 flex items-center gap-3 rounded-lg border p-4",
            phase === "locked" ? "border-destructive bg-destructive/20" : "border-warning/50 bg-warning/10",
          )}
        >
          <AlertTriangle
            className={cn("h-6 w-6 shrink-0", phase === "locked" ? "text-destructive" : "text-warning")}
          />
          <div>
            <p className={cn("font-bold", phase === "locked" ? "text-destructive" : "text-warning")}>
              불참 시 예치금 50,000P 차감
            </p>
            <p className="text-sm text-muted-foreground">
              낙찰된 사람의 배팅만 확정 시 예치금에서 차감됩니다.
            </p>
          </div>
        </div>

        {phase !== "locked" && !roomStatus?.auctionStartedAt && (
          <Button
            onClick={() => void startAuction()}
            disabled={!canStartAuction || busy}
            className="w-full gap-2 py-6 text-lg font-bold bg-destructive hover:bg-destructive/90"
            size="lg"
          >
            <Target className="h-5 w-5" />
            {canStartAuction
              ? "실시간 예치금 경매 시작"
              : "아직 모든 팀원이 제출하지 않았습니다"}
          </Button>
        )}

        {myReady && !roomStatus?.confirmedTime && (
          <p className="mt-3 text-center text-sm font-medium text-success">
            내 배팅이 확정되었습니다. 팀원 확정을 기다리는 중입니다.
          </p>
        )}

        {!currentUser && phase !== "locked" && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            배팅하려면 내 시간표 페이지에서 로그인한 뒤 새로고침하세요.
          </p>
        )}

        {phase === "locked" && (
          <div className="space-y-3">
            <Button
              className="w-full gap-2 py-6 text-lg font-bold"
              size="lg"
              onClick={() => {
                window.location.href = "/shop";
              }}
            >
              <Calendar className="h-5 w-5" />
              캘린더에 일정 추가
            </Button>
            <Button variant="destructive" className="w-full" onClick={handlePenalty}>
              불참 선언(50,000P 차감)
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RoulettePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pb-20 md:pb-0">
          <Navigation />
          <main className="mx-auto max-w-2xl px-4 py-6 text-sm text-muted-foreground">
            불러오는 중…
          </main>
        </div>
      }
    >
      <RoulettePageInner />
    </Suspense>
  );
}
