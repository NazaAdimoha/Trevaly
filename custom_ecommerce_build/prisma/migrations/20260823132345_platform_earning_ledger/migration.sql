-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "platformFeeKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlatformEarning" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "orderTotalKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEarning_orderId_key" ON "PlatformEarning"("orderId");

-- CreateIndex
CREATE INDEX "PlatformEarning_tenantId_createdAt_idx" ON "PlatformEarning"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformEarning_reference_idx" ON "PlatformEarning"("reference");

-- CreateIndex
CREATE INDEX "PlatformEarning_createdAt_idx" ON "PlatformEarning"("createdAt");
