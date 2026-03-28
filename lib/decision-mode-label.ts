export function decisionModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case "BID_POOL":
      return "후보별 배팅 합산 (최고 합 시간 낙찰)";
    case "BID_ALL_ZERO":
      return "전원 0원 배팅 → 후보 중 랜덤 (차감 없음)";
    case "COMMON_PREFERRED":
      return "지망 반영 (고액 예치금)";
    case "COMMON_RANDOM_ZERO":
      return "공통 시간 랜덤 (예치금 0)";
    case "COMMON_RANDOM_FALLBACK":
      return "공통 시간 랜덤 (지망 없음)";
    case "AUCTION":
      return "예치금 경매 (공통 없음)";
    default:
      return mode ?? "—";
  }
}
