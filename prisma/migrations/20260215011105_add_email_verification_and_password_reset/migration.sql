-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "emailVerificationTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationTokenHash" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "User_emailVerificationTokenHash_idx" ON "public"."User"("emailVerificationTokenHash");

-- CreateIndex
CREATE INDEX "User_passwordResetTokenHash_idx" ON "public"."User"("passwordResetTokenHash");
