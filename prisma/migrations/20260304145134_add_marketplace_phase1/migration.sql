-- CreateEnum
CREATE TYPE "public"."SellerStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."SellerVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceListingCategory" AS ENUM ('COMIC', 'MANGA', 'BOOK', 'COLLECTOR_VOLUME');

-- CreateEnum
CREATE TYPE "public"."MarketplaceListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'REMOVED_BY_ADMIN', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceItemCondition" AS ENUM ('LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE', 'HAS_DETAILS');

-- CreateEnum
CREATE TYPE "public"."MarketplaceAssetType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."MarketplaceReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'REMOVE');

-- CreateEnum
CREATE TYPE "public"."MarketplaceAppealStatus" AS ENUM ('NONE', 'PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."MarketplaceOrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'ON_HOLD', 'READY_TO_RELEASE', 'RELEASED', 'CANCELED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "sellerStatus" "public"."SellerStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "public"."SellerVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."SellerVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "dniFrontPath" TEXT NOT NULL,
    "dniBackPath" TEXT NOT NULL,
    "selfiePath" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "public"."MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "public"."MarketplaceListingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "genre" TEXT,
    "language" TEXT,
    "edition" TEXT,
    "publicationYear" INTEGER,
    "isbn" TEXT,
    "condition" "public"."MarketplaceItemCondition" NOT NULL,
    "conditionNotes" TEXT,
    "declaredDefects" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "coverAssetId" TEXT,
    "adminReason" TEXT,
    "appealStatus" "public"."MarketplaceAppealStatus" NOT NULL DEFAULT 'NONE',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceListingAsset" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "public"."MarketplaceAssetType" NOT NULL,
    "path" TEXT NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "isEvidence" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceListingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceReview" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "public"."MarketplaceReviewDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceAppeal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "public"."MarketplaceAppealStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "public"."MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "public"."PaymentMethod",
    "shippingProvider" TEXT,
    "shippingCity" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "platformCommission" DECIMAL(10,2) NOT NULL,
    "sellerNetAmount" DECIMAL(10,2) NOT NULL,
    "buyerTotal" DECIMAL(10,2) NOT NULL,
    "payoutStatus" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "mpPreferenceId" TEXT,
    "mpInitPoint" TEXT,
    "mpSandboxInitPoint" TEXT,
    "mpPaymentId" TEXT,
    "mpPaymentStatus" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "payoutReleasedAt" TIMESTAMP(3),
    "disputeOpenedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerVerificationRequest_userId_idx" ON "public"."SellerVerificationRequest"("userId");

-- CreateIndex
CREATE INDEX "SellerVerificationRequest_status_idx" ON "public"."SellerVerificationRequest"("status");

-- CreateIndex
CREATE INDEX "SellerVerificationRequest_createdAt_idx" ON "public"."SellerVerificationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_idx" ON "public"."MarketplaceListing"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "public"."MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_isActive_idx" ON "public"."MarketplaceListing"("isActive");

-- CreateIndex
CREATE INDEX "MarketplaceListing_category_idx" ON "public"."MarketplaceListing"("category");

-- CreateIndex
CREATE INDEX "MarketplaceListing_publishedAt_idx" ON "public"."MarketplaceListing"("publishedAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_createdAt_idx" ON "public"."MarketplaceListing"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListingAsset_listingId_idx" ON "public"."MarketplaceListingAsset"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceListingAsset_type_idx" ON "public"."MarketplaceListingAsset"("type");

-- CreateIndex
CREATE INDEX "MarketplaceReview_listingId_idx" ON "public"."MarketplaceReview"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceReview_reviewerId_idx" ON "public"."MarketplaceReview"("reviewerId");

-- CreateIndex
CREATE INDEX "MarketplaceReview_createdAt_idx" ON "public"."MarketplaceReview"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceAppeal_listingId_idx" ON "public"."MarketplaceAppeal"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceAppeal_sellerId_idx" ON "public"."MarketplaceAppeal"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceAppeal_status_idx" ON "public"."MarketplaceAppeal"("status");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_buyerId_idx" ON "public"."MarketplaceOrder"("buyerId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_sellerId_idx" ON "public"."MarketplaceOrder"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_listingId_idx" ON "public"."MarketplaceOrder"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_status_idx" ON "public"."MarketplaceOrder"("status");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_payoutStatus_idx" ON "public"."MarketplaceOrder"("payoutStatus");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_mpPreferenceId_idx" ON "public"."MarketplaceOrder"("mpPreferenceId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_mpPaymentId_idx" ON "public"."MarketplaceOrder"("mpPaymentId");

-- CreateIndex
CREATE INDEX "User_sellerStatus_idx" ON "public"."User"("sellerStatus");

-- CreateIndex
CREATE INDEX "User_country_province_city_idx" ON "public"."User"("country", "province", "city");

-- AddForeignKey
ALTER TABLE "public"."SellerVerificationRequest" ADD CONSTRAINT "SellerVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceListingAsset" ADD CONSTRAINT "MarketplaceListingAsset_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceAppeal" ADD CONSTRAINT "MarketplaceAppeal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
