-- CreateEnum
CREATE TYPE "StorefrontTheme" AS ENUM ('CLASSIC', 'EDITORIAL', 'UTILITY');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "theme" "StorefrontTheme" NOT NULL DEFAULT 'CLASSIC';
