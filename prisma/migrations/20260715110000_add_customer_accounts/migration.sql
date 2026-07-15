-- Customer accounts are store-scoped. Abort instead of silently assigning a
-- customer that already appears in orders from more than one store.
ALTER TABLE "Customer" ADD COLUMN "storeId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "authUserId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Order"
    GROUP BY "customerId"
    HAVING COUNT(DISTINCT "storeId") > 1
  ) THEN
    RAISE EXCEPTION 'Customer linked to orders from multiple stores; manual split required';
  END IF;
END $$;

UPDATE "Customer" AS customer
SET "storeId" = source."storeId"
FROM (
  SELECT "customerId", MIN("storeId") AS "storeId"
  FROM "Order"
  GROUP BY "customerId"
) AS source
WHERE source."customerId" = customer."id";

DO $$
DECLARE fallback_store_id TEXT;
BEGIN
  SELECT "id" INTO fallback_store_id FROM "Store" ORDER BY "createdAt" ASC LIMIT 1;
  UPDATE "Customer" SET "storeId" = fallback_store_id WHERE "storeId" IS NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Customer" WHERE "storeId" IS NULL) THEN
    RAISE EXCEPTION 'Customer rows exist but no store is available for backfill';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Customer"
    GROUP BY "storeId", "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate customer phone within a store; manual merge required';
  END IF;
END $$;

ALTER TABLE "Customer" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Customer_storeId_phone_key" ON "Customer"("storeId", "phone");
CREATE UNIQUE INDEX "Customer_storeId_authUserId_key" ON "Customer"("storeId", "authUserId");
CREATE INDEX "Customer_storeId_email_idx" ON "Customer"("storeId", "email");
