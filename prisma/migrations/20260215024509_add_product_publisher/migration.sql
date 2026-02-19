-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "publisher" TEXT;

-- CreateIndex
CREATE INDEX "Product_publisher_idx" ON "public"."Product"("publisher");
