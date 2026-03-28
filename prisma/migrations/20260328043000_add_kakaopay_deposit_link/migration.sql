-- AlterTable
ALTER TABLE "User"
ADD COLUMN "kakaoPayLinked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "kakaoPayAccountName" TEXT,
ADD COLUMN "kakaoPayAccountKey" TEXT,
ADD COLUMN "kakaoPayConnectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DepositTransaction" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositTransaction_userId_idx" ON "DepositTransaction"("userId");

-- AddForeignKey
ALTER TABLE "DepositTransaction" ADD CONSTRAINT "DepositTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
