-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'MERCADOPAGO';

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "mpInitPoint" TEXT,
ADD COLUMN     "mpLastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "mpMerchantOrderId" TEXT,
ADD COLUMN     "mpPaymentId" TEXT,
ADD COLUMN     "mpPaymentStatus" TEXT,
ADD COLUMN     "mpPreferenceId" TEXT,
ADD COLUMN     "mpSandboxInitPoint" TEXT;

-- CreateIndex
CREATE INDEX "Order_mpPreferenceId_idx" ON "public"."Order"("mpPreferenceId");

-- CreateIndex
CREATE INDEX "Order_mpPaymentId_idx" ON "public"."Order"("mpPaymentId");
