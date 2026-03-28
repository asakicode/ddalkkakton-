"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const auction_1 = require("../lib/auction");
const slot_keys_1 = require("../lib/slot-keys");
function participant(input) {
    return {
        userId: input.userId,
        balance: input.balance,
        blocked: new Set(input.blocked ?? []),
        preferredSlot: input.preferredSlot ?? null,
        bidAmount: input.bidAmount ?? 0,
    };
}
function blockedExcept(slot) {
    return (0, slot_keys_1.allSlotKeys)().filter((key) => key !== slot);
}
const commonAuction = (0, auction_1.resolveRoomAuction)([
    participant({ userId: 1, balance: 100000, preferredSlot: "월-09:00", bidAmount: 3000 }),
    participant({ userId: 2, balance: 100000, preferredSlot: "화-10:00", bidAmount: 7000 }),
], { randomFn: () => 0 });
strict_1.default.equal(commonAuction.confirmedTime, "화-10:00");
strict_1.default.equal(commonAuction.decisionMode, "COMMON_AUCTION");
strict_1.default.equal(commonAuction.winnerUserId, 2);
strict_1.default.deepEqual(commonAuction.charges, [{ userId: 1, amount: 3000 }]);
const noCommonAuction = (0, auction_1.resolveRoomAuction)([
    participant({
        userId: 1,
        balance: 100000,
        blocked: blockedExcept("화-10:00"),
        preferredSlot: "화-10:00",
        bidAmount: 12000,
    }),
    participant({
        userId: 2,
        balance: 100000,
        blocked: blockedExcept("월-09:00"),
        preferredSlot: "월-09:00",
        bidAmount: 9000,
    }),
], { randomFn: () => 0 });
strict_1.default.equal(noCommonAuction.confirmedTime, "화-10:00");
strict_1.default.equal(noCommonAuction.decisionMode, "AUCTION");
strict_1.default.equal(noCommonAuction.winnerUserId, 1);
strict_1.default.deepEqual(noCommonAuction.charges, [{ userId: 2, amount: 9000 }]);
const staleBalanceClamp = (0, auction_1.resolveRoomAuction)([participant({ userId: 1, balance: 2000, preferredSlot: "수-11:00", bidAmount: 5000 })], { randomFn: () => 0 });
strict_1.default.equal(staleBalanceClamp.winningBid, 2000);
const sharedWinningSlot = (0, auction_1.resolveRoomAuction)([
    participant({ userId: 1, balance: 100000, preferredSlot: "목-12:00", bidAmount: 8000 }),
    participant({ userId: 2, balance: 100000, preferredSlot: "목-12:00", bidAmount: 5000 }),
    participant({ userId: 3, balance: 100000, preferredSlot: "금-13:00", bidAmount: 4000 }),
], { randomFn: () => 0 });
strict_1.default.equal(sharedWinningSlot.confirmedTime, "목-12:00");
strict_1.default.deepEqual(sharedWinningSlot.charges, [
    { userId: 2, amount: 5000 },
    { userId: 3, amount: 4000 },
]);
console.log("auction contract ok");
