-- CreateTable
CREATE TABLE "public"."ApiErrorLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiErrorLog_createdAt_idx" ON "public"."ApiErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiErrorLog_occurredAt_idx" ON "public"."ApiErrorLog"("occurredAt");

-- CreateIndex
CREATE INDEX "ApiErrorLog_requestId_idx" ON "public"."ApiErrorLog"("requestId");

-- CreateIndex
CREATE INDEX "ApiErrorLog_statusCode_idx" ON "public"."ApiErrorLog"("statusCode");

-- CreateIndex
CREATE INDEX "ApiErrorLog_userId_idx" ON "public"."ApiErrorLog"("userId");
