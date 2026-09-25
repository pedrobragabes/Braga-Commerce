CREATE TABLE "PaymentAccountBinding" (
  "key" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "collectorId" TEXT NOT NULL CHECK ("collectorId" ~ '^[0-9]{1,24}$'),
  "environment" TEXT NOT NULL CHECK ("environment" IN ('sandbox', 'production')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PaymentAccountBinding_key_storeId_key" ON "PaymentAccountBinding"("key", "storeId");
CREATE INDEX "PaymentAccountBinding_storeId_idx" ON "PaymentAccountBinding"("storeId");
ALTER TABLE "Order" ADD COLUMN "paymentAccountKey" TEXT, ADD COLUMN "paymentLegacy" BOOLEAN NOT NULL DEFAULT false;
-- Preserve legacy history without guessing a store/account. A configured legacy
-- account can bind these rows only after store/collector/environment verification.
UPDATE "Order" SET "paymentLegacy" = true WHERE "mercadoPagoPreferenceId" IS NOT NULL OR "mercadoPagoPaymentId" IS NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentAccountKey_storeId_fkey"
  FOREIGN KEY ("paymentAccountKey", "storeId") REFERENCES "PaymentAccountBinding"("key", "storeId") ON DELETE RESTRICT ON UPDATE RESTRICT;
