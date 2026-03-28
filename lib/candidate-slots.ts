import { SCHEDULE_DAYS, SCHEDULE_HOURS } from "@/lib/slot-keys";

/** 전원 공통 가능 슬롯 키: "월-14:00" */
export function commonFreeSlots(blockedByUser: Set<string>[]): string[] {
  const out: string[] = [];
  for (const day of SCHEDULE_DAYS) {
    for (const time of SCHEDULE_HOURS) {
      const key = `${day}-${time}`;
      const allFree = blockedByUser.every((set) => !set.has(key));
      if (allFree) out.push(key);
    }
  }
  return out;
}

export function formatSlotLabel(key: string): string {
  const i = key.indexOf("-");
  if (i <= 0) return key;
  return `${key.slice(0, i)} ${key.slice(i + 1)}`;
}
