-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "binding" TEXT,
ADD COLUMN     "conditionLabel" TEXT,
ADD COLUMN     "dimensions" TEXT,
ADD COLUMN     "edition" TEXT,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "originCountry" TEXT,
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "publicationYear" INTEGER;

-- CreateIndex
CREATE INDEX "Product_genre_idx" ON "public"."Product"("genre");

-- CreateIndex
CREATE INDEX "Product_language_idx" ON "public"."Product"("language");

-- CreateIndex
CREATE INDEX "Product_binding_idx" ON "public"."Product"("binding");

-- CreateIndex
CREATE INDEX "Product_publicationYear_idx" ON "public"."Product"("publicationYear");
