"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULE_HOURS = exports.SCHEDULE_DAYS = void 0;
exports.allSlotKeys = allSlotKeys;
/** 월~일, 30분 단위 슬롯 키: "월-09:00" */
exports.SCHEDULE_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
exports.SCHEDULE_HOURS = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
});
function allSlotKeys() {
    const keys = [];
    for (const day of exports.SCHEDULE_DAYS) {
        for (const time of exports.SCHEDULE_HOURS) {
            keys.push(`${day}-${time}`);
        }
    }
    return keys;
}
