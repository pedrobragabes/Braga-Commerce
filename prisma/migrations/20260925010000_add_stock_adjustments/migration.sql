CREATE TABLE "StockAdjustment" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "requestId" TEXT NOT NULL,
  "quantityBefore" INTEGER NOT NULL,
  "delta" INTEGER NOT NULL,
  "quantityAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockAdjustment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockAdjustment_amounts_valid" CHECK (
    "quantityBefore" >= 0 AND "quantityAfter" >= 0 AND "delta" <> 0
    AND "quantityAfter"::BIGINT = "quantityBefore"::BIGINT + "delta"::BIGINT
  ),
  CONSTRAINT "StockAdjustment_reason_required" CHECK (char_length(trim("reason")) BETWEEN 3 AND 500)
);
CREATE UNIQUE INDEX "StockAdjustment_storeId_requestId_key" ON "StockAdjustment"("storeId", "requestId");
CREATE INDEX "StockAdjustment_storeId_productId_createdAt_idx" ON "StockAdjustment"("storeId", "productId", "createdAt");
