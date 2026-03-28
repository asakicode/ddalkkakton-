"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, Lock, Calendar, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "ready" | "spinning" | "locked" | "no-common";

interface CurrentUser {
  id: number;
  name: string;
  balance: number;
}

interface RoomStatus {
  code: string;
  capacity: number;
  submittedCount: number;
  confirmedSlot: string | null;
}

export function RouletteContent() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("ready");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const codeFromQuery = searchParams.get("code");
    const codeFromStorage = localStorage.getItem("currentRoomCode");
    const finalCode = codeFromQuery ?? codeFromStorage;
    if (finalCode) {
      setRoomCode(finalCode.toUpperCase());
      localStorage.setItem("currentRoomCode", finalCode.toUpperCase());
    }

    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser) as CurrentUser);
      } catch {
        // ignore
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!roomCode) return;
    const fetchStatus = async () => {
      const res = await fetch(`/api/room/${roomCode}`);
      if (!res.ok) return;
      const data = (await res.json()) as RoomStatus;
      setRoomStatus(data);
      if (data.confirmedSlot) {
        setSelectedSlot(data.confirmedSlot);
        setPhase("locked");
      }
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 2000);
    return () => clearInterval(timer);
  }, [roomCode]);

  const canSpin = useMemo(() => {
    if (!roomStatus) return false;
    return roomStatus.submittedCount >= roomStatus.capacity;
  }, [roomStatus]);

  const startSpin = async () => {
    if (!roomCode) {
      setError("방 코드가 없습니다. 방 페이지에서 다시 입장해주세요.");
      return;
    }
    setError(null);
    setPhase("spinning");

    const res = await fetch("/api/roulette", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomCode }),
    });

    const data = await res.json();
    if (!res.ok) {
      setPhase("ready");
      setError(data.error || "룰렛 실행 중 오류가 발생했습니다.");
      return;
    }

    if (data.status === "no-common") {
      setPhase("no-common");
      return;
    }

    setSelectedSlot(data.confirmedSlot as string);
    setPhase("locked");
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
    alert(`불참 처리 완료: 현재 잔액 ${nextUser.balance.toLocaleString("ko-KR")}P`);
  };

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
            <h1 className="text-xl font-bold text-foreground">운명의 룰렛</h1>
            <p className="text-sm text-muted-foreground">
              공통 빈 시간 중 하나가 강제 확정됩니다
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mb-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          방 코드: <span className="font-mono font-semibold text-foreground">{roomCode ?? "-"}</span> / 제출
          인원: {roomStatus?.submittedCount ?? 0}/{roomStatus?.capacity ?? "-"}
        </div>

        <div
          className={cn(
            "relative mb-8 overflow-hidden rounded-2xl border-2 p-8 text-center transition-all",
            phase === "locked" ? "animate-siren border-destructive bg-destructive/10" : "border-border bg-card",
          )}
        >
          {phase === "ready" && (
            <div className="space-y-4">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                <Calendar className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-lg text-muted-foreground">조건 충족 후 룰렛을 실행하세요.</p>
            </div>
          )}

          {phase === "spinning" && (
            <div className="space-y-4">
              <div className="text-4xl font-bold text-warning animate-pulse">추첨 중...</div>
            </div>
          )}

          {phase === "no-common" && (
            <div className="space-y-4">
              <p className="text-2xl font-bold text-destructive">공통 시간이 없습니다</p>
              <p className="text-muted-foreground">재입력 요청: 팀원 전원이 시간표를 다시 조정해주세요.</p>
            </div>
          )}

          {phase === "locked" && selectedSlot && (
            <div className="space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive animate-pulse">
                <Lock className="h-10 w-10 text-destructive-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">확정 시간</p>
                <p className="text-2xl font-bold text-destructive">{selectedSlot}</p>
              </div>
              <p className="text-sm text-muted-foreground">이 시간에 전원이 참석해야 합니다</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {phase !== "locked" && (
            <Button
              onClick={startSpin}
              disabled={!canSpin}
              size="lg"
              className="w-full"
              variant={canSpin ? "default" : "secondary"}
            >
              <Target className="mr-2 h-4 w-4" />
              {canSpin ? "룰렛 시작" : "모든 팀원 제출 대기 중"}
            </Button>
          )}

          {phase === "locked" && (
            <Button
              onClick={handlePenalty}
              size="lg"
              className="w-full"
              variant="destructive"
            >
              <Skull className="mr-2 h-4 w-4" />
              불참 신고
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
