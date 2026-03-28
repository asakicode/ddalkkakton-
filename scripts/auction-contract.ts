import assert from "node:assert/strict";
import { resolveRoomAuction, type AuctionParticipant } from "../lib/auction";
import { allSlotKeys } from "../lib/slot-keys";

function participant(input: {
  userId: number;
  balance: number;
  blocked?: string[];
  preferredSlot?: string | null;
  bidAmount?: number;
}): AuctionParticipant {
  return {
    userId: input.userId,
    balance: input.balance,
    blocked: new Set(input.blocked ?? []),
    preferredSlot: input.preferredSlot ?? null,
    bidAmount: input.bidAmount ?? 0,
  };
}

function blockedExcept(slot: string) {
  return allSlotKeys().filter((key) => key !== slot)
}

const commonAuction = resolveRoomAuction(
  [
    participant({ userId: 1, balance: 100000, preferredSlot: "월-09:00", bidAmount: 3000 }),
    participant({ userId: 2, balance: 100000, preferredSlot: "화-10:00", bidAmount: 7000 }),
  ],
  { randomFn: () => 0 },
);
assert.equal(commonAuction.confirmedTime, "화-10:00");
assert.equal(commonAuction.decisionMode, "COMMON_AUCTION");
assert.equal(commonAuction.winnerUserId, 2);
assert.deepEqual(commonAuction.charges, [{ userId: 1, amount: 3000 }]);

const noCommonAuction = resolveRoomAuction(
  [
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
  ],
  { randomFn: () => 0 },
);
assert.equal(noCommonAuction.confirmedTime, "화-10:00");
assert.equal(noCommonAuction.decisionMode, "AUCTION");
assert.equal(noCommonAuction.winnerUserId, 1);
assert.deepEqual(noCommonAuction.charges, [{ userId: 2, amount: 9000 }]);

const staleBalanceClamp = resolveRoomAuction(
  [participant({ userId: 1, balance: 2000, preferredSlot: "수-11:00", bidAmount: 5000 })],
  { randomFn: () => 0 },
);
assert.equal(staleBalanceClamp.winningBid, 2000);

const sharedWinningSlot = resolveRoomAuction(
  [
    participant({ userId: 1, balance: 100000, preferredSlot: "목-12:00", bidAmount: 8000 }),
    participant({ userId: 2, balance: 100000, preferredSlot: "목-12:00", bidAmount: 5000 }),
    participant({ userId: 3, balance: 100000, preferredSlot: "금-13:00", bidAmount: 4000 }),
  ],
  { randomFn: () => 0 },
);
assert.equal(sharedWinningSlot.confirmedTime, "목-12:00");
assert.deepEqual(sharedWinningSlot.charges, [
  { userId: 2, amount: 5000 },
  { userId: 3, amount: 4000 },
]);

console.log("auction contract ok");
