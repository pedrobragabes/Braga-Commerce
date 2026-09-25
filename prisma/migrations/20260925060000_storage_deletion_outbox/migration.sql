ALTER TABLE "ProductImage" ADD COLUMN "storageBucket" TEXT;
CREATE TABLE "StorageDeletionJob" (
  "id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "productId" TEXT NOT NULL,
  "imageId" TEXT, "actorId" TEXT NOT NULL, "bucket" TEXT NOT NULL, "storagePath" TEXT NOT NULL,
  "reason" TEXT NOT NULL CHECK ("reason" IN ('IMAGE_DELETED', 'UPLOAD_COMPENSATION')),
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'BLOCKED')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "claimToken" TEXT, "lockedUntil" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastErrorCode" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StorageDeletionJob_imageId_key" ON "StorageDeletionJob"("imageId");
CREATE UNIQUE INDEX "StorageDeletionJob_bucket_storagePath_key" ON "StorageDeletionJob"("bucket", "storagePath");
CREATE INDEX "StorageDeletionJob_status_nextAttemptAt_idx" ON "StorageDeletionJob"("status", "nextAttemptAt");
CREATE INDEX "StorageDeletionJob_storeId_productId_status_idx" ON "StorageDeletionJob"("storeId", "productId", "status");
