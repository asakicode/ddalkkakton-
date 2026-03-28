"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRoomAuction = resolveRoomAuction;
const slot_keys_1 = require("./slot-keys");
function canonicalSlotOrder() {
    const keys = (0, slot_keys_1.allSlotKeys)();
    return new Map(keys.map((key, index) => [key, index]));
}
function normalizeBid(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}
function effectiveBid(participant) {
    return Math.min(normalizeBid(participant.bidAmount), Math.max(0, participant.balance));
}
function pickRandom(items, randomFn) {
    return items[Math.floor(randomFn() * items.length)];
}
function commonFreeSlots(participants, slotKeys) {
    return slotKeys.filter((slot) => participants.every((participant) => !participant.blocked.has(slot)));
}
function unionFreeSlots(participants, slotKeys) {
    return slotKeys.filter((slot) => participants.some((participant) => !participant.blocked.has(slot)));
}
function buildEligibleBidders(participants, allowSlot) {
    const bidders = [];
    for (const participant of participants) {
        if (!participant.preferredSlot) {
            continue;
        }
        const slot = participant.preferredSlot;
        if (participant.blocked.has(slot) || !allowSlot(slot)) {
            continue;
        }
        const bid = effectiveBid(participant);
        if (bid <= 0) {
            continue;
        }
        bidders.push({
            userId: participant.userId,
            preferredSlot: slot,
            effectiveBid: bid,
        });
    }
    return bidders;
}
function pickWinningBidder(bidders, slotOrder) {
    return [...bidders].sort((left, right) => {
        if (right.effectiveBid !== left.effectiveBid) {
            return right.effectiveBid - left.effectiveBid;
        }
        const leftOrder = slotOrder.get(left.preferredSlot) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = slotOrder.get(right.preferredSlot) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }
        return left.userId - right.userId;
    })[0];
}
function buildCharges(bidders, winnerUserId) {
    return bidders
        .filter((bidder) => bidder.userId === winnerUserId)
        .map((bidder) => ({ userId: bidder.userId, amount: bidder.effectiveBid }));
}
function resolveRoomAuction(participants, options) {
    const slotKeys = (0, slot_keys_1.allSlotKeys)();
    const slotOrder = canonicalSlotOrder();
    const randomFn = options?.randomFn ?? Math.random;
    if (participants.length === 0) {
        throw new Error("참여자가 없습니다.");
    }
    const commonSlots = commonFreeSlots(participants, slotKeys);
    if (commonSlots.length > 0) {
        const eligibleBidders = buildEligibleBidders(participants, (slot) => commonSlots.includes(slot));
        if (eligibleBidders.length > 0) {
            const winner = pickWinningBidder(eligibleBidders, slotOrder);
            return {
                confirmedTime: winner.preferredSlot,
                decisionMode: "COMMON_AUCTION",
                winnerUserId: winner.userId,
                winningBid: winner.effectiveBid,
                charges: buildCharges(eligibleBidders, winner.userId),
                eligibleBidderCount: eligibleBidders.length,
            };
        }
        return {
            confirmedTime: pickRandom(commonSlots, randomFn),
            decisionMode: "COMMON_RANDOM_ZERO",
            winnerUserId: null,
            winningBid: 0,
            charges: [],
            eligibleBidderCount: 0,
        };
    }
    const eligibleBidders = buildEligibleBidders(participants, () => true);
    if (eligibleBidders.length > 0) {
        const winner = pickWinningBidder(eligibleBidders, slotOrder);
        return {
            confirmedTime: winner.preferredSlot,
            decisionMode: "AUCTION",
            winnerUserId: winner.userId,
            winningBid: winner.effectiveBid,
            charges: buildCharges(eligibleBidders, winner.userId),
            eligibleBidderCount: eligibleBidders.length,
        };
    }
    const fallbackSlots = unionFreeSlots(participants, slotKeys);
    if (fallbackSlots.length === 0) {
        throw new Error("빈 시간을 찾을 수 없습니다.");
    }
    return {
        confirmedTime: pickRandom(fallbackSlots, randomFn),
        decisionMode: "AUCTION_ZERO_BID",
        winnerUserId: null,
        winningBid: 0,
        charges: [],
        eligibleBidderCount: 0,
    };
}
