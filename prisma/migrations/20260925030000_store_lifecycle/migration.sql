BEGIN;
-- CreateEnum
CREATE TYPE "SalesAccessMode" AS ENUM ('LEGACY_PILOT', 'ASSISTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDING', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ActivationOrigin" AS ENUM ('ADMINISTRATIVE', 'COURTESY', 'EXTERNAL_CONFIRMATION');

-- CreateEnum
CREATE TYPE "StoreApplicationStatus" AS ENUM ('REQUESTED', 'PROVISIONED', 'REJECTED');

-- DropIndex
DROP INDEX "User_authUserId_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "salesAccessMode" "SalesAccessMode" NOT NULL DEFAULT 'ASSISTED';

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "themeDraftVersion" INTEGER,
ADD COLUMN     "themePublishedVersion" INTEGER,
ADD COLUMN     "themeVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StoreThemeRevision" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreThemeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreAuditEvent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "checkoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "activationOrigin" "ActivationOrigin",
    "confirmedBy" TEXT,
    "confirmationReference" TEXT,
    "acceptedPlanVersion" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptedBy" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreApplication" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requesterAuthUserId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeSlug" TEXT NOT NULL,
    "planId" TEXT,
    "acceptedPlanVersion" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "status" "StoreApplicationStatus" NOT NULL DEFAULT 'REQUESTED',
    "storeId" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreThemeRevision_storeId_version_key" ON "StoreThemeRevision"("storeId", "version");

-- CreateIndex
CREATE INDEX "StoreAuditEvent_storeId_createdAt_idx" ON "StoreAuditEvent"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOperator_authUserId_key" ON "PlatformOperator"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_version_key" ON "Plan"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_storeId_key" ON "Subscription"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreApplication_requestKey_key" ON "StoreApplication"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoreApplication_storeId_key" ON "StoreApplication"("storeId");

-- CreateIndex
CREATE INDEX "StoreApplication_requesterAuthUserId_createdAt_idx" ON "StoreApplication"("requesterAuthUserId", "createdAt");

-- CreateIndex
UPDATE "Store" SET "domain" = NULLIF(lower(btrim("domain")), '') WHERE "domain" IS NOT NULL;
CREATE UNIQUE INDEX "Store_domain_key" ON "Store"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "User_storeId_authUserId_key" ON "User"("storeId", "authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_storeId_email_key" ON "User"("storeId", "email");

-- AddForeignKey
ALTER TABLE "StoreThemeRevision" ADD CONSTRAINT "StoreThemeRevision_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreAuditEvent" ADD CONSTRAINT "StoreAuditEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreApplication" ADD CONSTRAINT "StoreApplication_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreApplication" ADD CONSTRAINT "StoreApplication_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve existing pilot operation without inventing subscription payments.
UPDATE "Store" SET "salesAccessMode" = 'LEGACY_PILOT';
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_period_check" CHECK (("startsAt" IS NULL AND "endsAt" IS NULL) OR ("startsAt" IS NOT NULL AND "endsAt" > "startsAt"));
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_price_check" CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

COMMIT;
