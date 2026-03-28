import { allSlotKeys } from "./slot-keys";

export type AuctionDecisionMode =
  | "COMMON_AUCTION"
  | "COMMON_RANDOM_ZERO"
  | "AUCTION"
  | "AUCTION_ZERO_BID";

export type AuctionParticipant = {
  userId: number;
  balance: number;
  blocked: Set<string>;
  preferredSlot: string | null;
  bidAmount: number;
};

export type AuctionCharge = {
  userId: number;
  amount: number;
};

export type AuctionResolution = {
  confirmedTime: string;
  decisionMode: AuctionDecisionMode;
  winnerUserId: number | null;
  winningBid: number;
  charges: AuctionCharge[];
  eligibleBidderCount: number;
};

type EligibleBidder = {
  userId: number;
  preferredSlot: string;
  effectiveBid: number;
};

function canonicalSlotOrder() {
  const keys = allSlotKeys();
  return new Map(keys.map((key, index) => [key, index]));
}

function normalizeBid(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function effectiveBid(participant: AuctionParticipant) {
  return Math.min(normalizeBid(participant.bidAmount), Math.max(0, participant.balance));
}

function pickRandom<T>(items: T[], randomFn: () => number) {
  return items[Math.floor(randomFn() * items.length)]!;
}

function commonFreeSlots(participants: AuctionParticipant[], slotKeys: string[]) {
  return slotKeys.filter((slot) => participants.every((participant) => !participant.blocked.has(slot)));
}

function unionFreeSlots(participants: AuctionParticipant[], slotKeys: string[]) {
  return slotKeys.filter((slot) => participants.some((participant) => !participant.blocked.has(slot)));
}

function buildEligibleBidders(
  participants: AuctionParticipant[],
  allowSlot: (slot: string) => boolean,
) {
  const bidders: EligibleBidder[] = [];

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

function pickWinningBidder(bidders: EligibleBidder[], slotOrder: Map<string, number>) {
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
  })[0]!;
}

function buildCharges(bidders: EligibleBidder[]) {
  return bidders.map((bidder) => ({ userId: bidder.userId, amount: bidder.effectiveBid }));
}

export function resolveRoomAuction(
  participants: AuctionParticipant[],
  options?: { randomFn?: () => number },
): AuctionResolution {
  const slotKeys = allSlotKeys();
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
        charges: buildCharges(eligibleBidders),
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
      charges: buildCharges(eligibleBidders),
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
