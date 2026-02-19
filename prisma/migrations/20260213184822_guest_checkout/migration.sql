-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestFirstName" TEXT,
ADD COLUMN     "guestLastName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;
