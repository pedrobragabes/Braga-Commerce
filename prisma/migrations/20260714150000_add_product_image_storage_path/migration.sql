ALTER TABLE "ProductImage" ADD COLUMN "storagePath" TEXT;

CREATE UNIQUE INDEX "ProductImage_storagePath_key" ON "ProductImage"("storagePath");
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");
