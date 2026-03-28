"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Lock, Skull, Target } from "lucide-react";
import { decisionModeLabel } from "@/lib/decision-mode-label";
import { formatSlotLabel } from "@/lib/candidate-slots";

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
}

type Phase = "waiting" | "drawing" | "result";

const POLL_MS = 1500;

function RoulettePageInner() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestedRef = useRef(false);

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
          // ignore
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
        // ignore
      }
    }
    if (uid == null) return;

    const res = await fetch(`/api/user/${uid}`);
    if (!res.ok) return;
    const data = (await res.json()) as CurrentUser;
    setCurrentUser(data);
    localStorage.setItem("currentUser", JSON.stringify(data));
  }, [currentUser?.id]);

  const fetchStatus = useCallback(async () => {
    if (!roomCode) return null;

    const uid = currentUser?.id;
    const q = uid != null ? `?userId=${encodeURIComponent(String(uid))}` : "";
    const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}${q}`);
    if (!res.ok) return null;

    const data = (await res.json()) as RoomStatus;
    setRoomStatus(data);

    const slot = data.result ?? data.confirmedTime ?? data.confirmedSlot ?? null;
    if (slot) {
      setSelectedSlot(slot);
      setPhase("result");
    } else if (data.submittedCount >= data.capacity) {
      setPhase("drawing");
    } else {
      setPhase("waiting");
    }

    return data;
  }, [roomCode, currentUser?.id]);

  const startAuction = useCallback(async () => {
    if (!roomCode || requestedRef.current) {
      return;
    }

    requestedRef.current = true;
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/room/${encodeURIComponent(roomCode)}/auction/start`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({} as { error?: string; confirmedTime?: string }));

    if (!res.ok) {
      requestedRef.current = false;
      setBusy(false);
      setError(data.error || "추첨 결과를 계산할 수 없습니다.");
      return;
    }

    await refreshUserBalance();
    if (data.confirmedTime) {
      setSelectedSlot(data.confirmedTime);
      setPhase("result");
    }
    await fetchStatus();
    setBusy(false);
  }, [roomCode, fetchStatus, refreshUserBalance]);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const data = await fetchStatus();
      if (
        !cancelled &&
        data &&
        !data.confirmedTime &&
        data.submittedCount >= data.capacity
      ) {
        await startAuction();
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roomCode, fetchStatus, startAuction]);

  const handlePenalty = async () => {
    if (!roomCode || !currentUser) {
      setError("로그인 정보 또는 방 코드가 없습니다.");
      return;
    }

    const res = await fetch("/api/penalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode, userId: currentUser.id }),
    });

    const data = await res.json().catch(() => ({} as { error?: string; balance?: number }));
    if (!res.ok) {
      alert(data.error || "불참 처리 실패");
      return;
    }

    const nextUser = { ...currentUser, balance: data.balance ?? currentUser.balance };
    localStorage.setItem("currentUser", JSON.stringify(nextUser));
    setCurrentUser(nextUser);
    localStorage.removeItem("currentRoomCode");
    alert(`불참 처리 완료: 현재 잔액 ${nextUser.balance.toLocaleString("ko-KR")}P, 방에서 나갔습니다.`);
    window.location.href = "/room";
  };

  const resultLabel = useMemo(() => {
    if (!selectedSlot) return null;
    return formatSlotLabel(selectedSlot);
  }, [selectedSlot]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navigation />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">예치금 경매 추첨 결과</h1>
            <p className="text-sm text-muted-foreground">
              내 시간표에서 제출한 지망 시간과 입찰 금액으로 자동 계산한 결과만 표시합니다.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          방 코드: <span className="font-mono font-semibold text-foreground">{roomCode ?? "-"}</span>
          {roomStatus ? (
            <>
              {" "}/ 제출 {roomStatus.submittedCount}/{roomStatus.capacity}
            </>
          ) : null}
        </div>

        {phase !== "result" ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Calendar className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-2 text-lg font-bold text-foreground">
              {phase === "drawing" ? "추첨 결과 계산 중" : "아직 모두 제출하지 않았습니다"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {phase === "drawing"
                ? busy
                  ? "제출된 시간표와 입찰 금액으로 결과를 계산하고 있습니다."
                  : "결과를 불러오고 있습니다."
                : "모든 팀원이 시간표를 제출하면 이 화면에서 자동으로 결과를 보여줍니다."}
            </p>
          </div>
        ) : (
          <div className="space-y-6 rounded-xl border border-border bg-card p-8">
            <div className="text-center">
              <Lock className="mx-auto mb-4 h-10 w-10 text-primary" />
              <p className="mb-2 text-sm font-medium text-muted-foreground">최종 확정 시간</p>
              <h2 className="text-3xl font-black text-foreground">
                {resultLabel ?? selectedSlot}
              </h2>
              {roomStatus?.decisionMode ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  확정 방식: {decisionModeLabel(roomStatus.decisionMode)}
                </p>
              ) : null}
              {roomStatus?.auctionWinningBid != null && roomStatus.auctionWinningBid > 0 ? (
                <p className="mt-2 text-sm text-warning">
                  낙찰 입찰 금액: {roomStatus.auctionWinningBid.toLocaleString("ko-KR")}P
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              내 시간표에서 제출한 지망 시간과 금액만 반영된 결과입니다.
              낙찰된 경우에만 예치금이 차감됩니다.
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handlePenalty}
            >
              <Skull className="mr-2 h-4 w-4" />
              불참 선언하기
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RoulettePage() {
  return (
    <Suspense>
      <RoulettePageInner />
    </Suspense>
  );
}
