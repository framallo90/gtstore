-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "ean" TEXT,
ADD COLUMN     "editor" TEXT,
ADD COLUMN     "heightCm" DECIMAL(6,2),
ADD COLUMN     "illustrator" TEXT,
ADD COLUMN     "isbn10" TEXT,
ADD COLUMN     "isbn13" TEXT,
ADD COLUMN     "narrator" TEXT,
ADD COLUMN     "publicationDate" TIMESTAMP(3),
ADD COLUMN     "seriesName" TEXT,
ADD COLUMN     "seriesNumber" INTEGER,
ADD COLUMN     "shippingEtaMaxDays" INTEGER,
ADD COLUMN     "shippingEtaMinDays" INTEGER,
ADD COLUMN     "subtitle" TEXT,
ADD COLUMN     "thicknessCm" DECIMAL(6,2),
ADD COLUMN     "translator" TEXT,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" DECIMAL(6,2);

-- CreateIndex
CREATE INDEX "Product_seriesName_idx" ON "public"."Product"("seriesName");

-- CreateIndex
CREATE INDEX "Product_conditionLabel_idx" ON "public"."Product"("conditionLabel");

-- CreateIndex
CREATE INDEX "Product_publicationDate_idx" ON "public"."Product"("publicationDate");

-- CreateIndex
CREATE INDEX "Product_isbn13_idx" ON "public"."Product"("isbn13");

-- CreateIndex
CREATE INDEX "Product_ean_idx" ON "public"."Product"("ean");
