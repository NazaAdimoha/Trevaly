-- CreateTable
CREATE TABLE "StorefrontLayout" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "published" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorefrontLayout_tenantId_key" ON "StorefrontLayout"("tenantId");

-- CreateIndex
CREATE INDEX "StorefrontLayout_tenantId_idx" ON "StorefrontLayout"("tenantId");

-- AddForeignKey
ALTER TABLE "StorefrontLayout" ADD CONSTRAINT "StorefrontLayout_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
