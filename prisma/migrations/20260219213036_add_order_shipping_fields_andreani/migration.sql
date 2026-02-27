-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingPostalCode" TEXT,
ADD COLUMN     "shippingProvider" TEXT;
