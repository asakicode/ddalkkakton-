import type { PrismaClient } from "@prisma/client";
import { commonFreeSlots } from "@/lib/candidate-slots";

type ScheduleData = {
  blocked?: string[];
  bidSlot?: string | null;
  bidAmount?: unknown;
  preferredSlot?: string | null;
};

/** 방에 제출된 최신 시간표(유저별)로부터 공통 후보 슬롯을 계산합니다. */
export async function computeCandidateSlots(
  prisma: PrismaClient,
  roomId: number,
): Promise<string[]> {
  const schedules = await prisma.schedule.findMany({
    where: { roomId },
    orderBy: { submittedAt: "desc" },
  });

  const latestByUser = new Map<number, Set<string>>();
  for (const s of schedules) {
    if (latestByUser.has(s.userId)) continue;
    const raw = s.data as ScheduleData;
    latestByUser.set(s.userId, new Set(raw.blocked ?? []));
  }

  if (latestByUser.size === 0) return [];
  return commonFreeSlots([...latestByUser.values()]);
}
