-- AlterTable
ALTER TABLE "Room" ADD COLUMN "auctionStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RoomBid" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "slotKey" TEXT,
    "bidAmount" INTEGER NOT NULL DEFAULT 0,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomBid_roomId_idx" ON "RoomBid"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBid_roomId_userId_key" ON "RoomBid"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "RoomBid" ADD CONSTRAINT "RoomBid_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBid" ADD CONSTRAINT "RoomBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
