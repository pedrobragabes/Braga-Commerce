ALTER TABLE "Order" ADD COLUMN "operationVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Order_id_storeId_key" ON "Order"("id", "storeId");
CREATE TABLE "OrderInventoryResolution" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "action" TEXT NOT NULL CHECK ("action" IN ('COMMIT_STOCK', 'CANCEL_FULFILLMENT')),
  "reason" TEXT NOT NULL CHECK (char_length(trim("reason")) BETWEEN 5 AND 500),
  "previousVersion" INTEGER NOT NULL CHECK ("previousVersion" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderInventoryResolution_orderId_storeId_fkey" FOREIGN KEY ("orderId", "storeId") REFERENCES "Order"("id", "storeId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderInventoryResolution_storeId_requestId_key" ON "OrderInventoryResolution"("storeId", "requestId");
CREATE INDEX "OrderInventoryResolution_orderId_createdAt_idx" ON "OrderInventoryResolution"("orderId", "createdAt");
