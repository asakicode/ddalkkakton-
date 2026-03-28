-- Rename confirmedSlot -> confirmedTime (요구사항 명칭)
ALTER TABLE "Room" RENAME COLUMN "confirmedSlot" TO "confirmedTime";

-- 확정 방식: COMMON_PREFERRED | COMMON_RANDOM_ZERO | COMMON_RANDOM_FALLBACK | AUCTION
ALTER TABLE "Room" ADD COLUMN "decisionMode" TEXT;
