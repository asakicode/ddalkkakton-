"use client";

import { useEffect, useMemo, useState } from "react";
import { Navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Copy, Check, Link2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function RoomPage() {
  const [memberCount, setMemberCount] = useState(5);
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser) as CurrentUser);
      } catch {
        // ignore parse error
      }
    }

    const storedRoomCode = localStorage.getItem("currentRoomCode");
    if (storedRoomCode) {
      setRoomCode(storedRoomCode);
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const fetchStatus = async () => {
      const res = await fetch(`/api/room/${roomCode}`);
      if (!res.ok) return;
      const data = (await res.json()) as RoomStatus;
      setRoomStatus(data);
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 2000);
    return () => clearInterval(timer);
  }, [roomCode]);

  const allReady = useMemo(() => {
    if (!roomStatus) return false;
    return roomStatus.submittedCount >= roomStatus.capacity;
  }, [roomStatus]);

  const createRoom = async () => {
    if (!currentUser) {
      setError("먼저 내 시간표 페이지에서 로그인해주세요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostId: currentUser.id,
        capacity: memberCount,
        code: createCode.trim() ? createCode.trim() : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "방 생성에 실패했습니다.");
      return;
    }
    const data = (await res.json()) as { code: string };
    setRoomCode(data.code);
    localStorage.setItem("currentRoomCode", data.code);
    setJoinCode(data.code);
  };

  const connectRoom = async () => {
    if (!joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    const res = await fetch(`/api/room/${code}`);
    if (!res.ok) {
      setError("유효하지 않은 방 코드입니다.");
      return;
    }
    setError(null);
    setRoomCode(code);
    localStorage.setItem("currentRoomCode", code);
  };

  const copyLink = () => {
    if (!roomCode) return;
    const link = `${window.location.origin}/room?code=${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goRoulette = () => {
    if (!roomCode) return;
    window.location.href = `/roulette?code=${roomCode}`;
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Navigation />

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">방 만들기 / 입장</h1>
            <p className="text-sm text-muted-foreground">
              인원이 모두 시간표 저장을 완료하면 룰렛을 시작할 수 있습니다.
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!roomCode ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <label className="mb-2 block text-sm font-medium text-foreground">
                참여 인원수
              </label>
              <div className="mb-4 flex items-center gap-3">
                {[2, 3, 4, 5, 6].map((count) => (
                  <button
                    key={count}
                    onClick={() => setMemberCount(count)}
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-lg font-bold transition-all",
                      memberCount === count
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                방 코드(선택)
              </label>
              <Input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="예: 방장1234 (비워두면 자동 생성)"
                className="mb-4 font-mono"
              />
              <Button onClick={createRoom} className="w-full gap-2" size="lg">
                <Link2 className="h-4 w-4" />
                새 방 만들기
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <label className="mb-2 block text-sm font-medium text-foreground">
                방 코드로 입장
              </label>
              <div className="flex gap-2">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="예: ABC123"
                  className="font-mono"
                />
                <Button variant="outline" onClick={connectRoom}>
                  입장
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">현재 방 코드</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-mono text-lg font-bold text-foreground">{roomCode}</p>
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                팀원은 내 시간표 페이지에서 시간표 저장 시 같은 방 코드로 저장해야 제출 완료로 집계됩니다.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-2 font-semibold text-foreground">시간표 제출 현황</h3>
              <p className="text-sm text-muted-foreground">
                {roomStatus?.submittedCount ?? 0}/{roomStatus?.capacity ?? memberCount} 명 완료
              </p>
            </div>

            <Button
              disabled={!allReady}
              className={cn(
                "w-full gap-2 py-6 text-lg font-bold transition-all",
                allReady && "animate-pulse-danger bg-destructive hover:bg-destructive/90",
              )}
              size="lg"
              onClick={goRoulette}
            >
              <Zap className="h-5 w-5" />
              {allReady
                ? "운명의 시간 추첨하기"
                : `${(roomStatus?.capacity ?? memberCount) - (roomStatus?.submittedCount ?? 0)}명 더 필요합니다`}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

