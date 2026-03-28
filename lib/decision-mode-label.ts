export function decisionModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case "COMMON_AUCTION":
      return "공통 시간 경매";
    case "COMMON_PREFERRED":
      return "지망 반영 (고액 예치금)";
    case "COMMON_RANDOM_ZERO":
      return "공통 시간 랜덤 (예치금 0)";
    case "COMMON_RANDOM_FALLBACK":
      return "공통 시간 랜덤 (지망 없음)";
    case "AUCTION":
      return "예치금 경매 (공통 없음)";
    case "AUCTION_ZERO_BID":
      return "입찰 없음 랜덤";
    default:
      return mode ?? "—";
  }
}
