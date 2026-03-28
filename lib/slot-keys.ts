/** 월~일, 30분 단위 슬롯 키: "월-09:00" */
export const SCHEDULE_DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const SCHEDULE_HOURS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

export function allSlotKeys(): string[] {
  const keys: string[] = [];
  for (const day of SCHEDULE_DAYS) {
    for (const time of SCHEDULE_HOURS) {
      keys.push(`${day}-${time}`);
    }
  }
  return keys;
}
