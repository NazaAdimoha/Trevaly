-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "disputeAmountKobo" INTEGER,
ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputeStatus" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "paymentFailureReason" TEXT,
ADD COLUMN     "refundedAmountKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PlatformEarning" ADD COLUMN     "reversedAt" TIMESTAMP(3);
