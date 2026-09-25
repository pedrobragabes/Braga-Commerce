BEGIN;

ALTER TABLE "Customer"
  ADD COLUMN "storeId" TEXT,
  ADD COLUMN "authUserId" TEXT,
  ADD COLUMN "isQuarantined" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "legacyCustomerId" TEXT;

-- Only actual order ownership is evidence for a customer's store.
UPDATE "Customer" AS customer
SET "storeId" = linked."storeId", "isQuarantined" = false
FROM (
  SELECT "customerId", MIN("storeId") AS "storeId"
  FROM "Order" GROUP BY "customerId" HAVING COUNT(DISTINCT "storeId") = 1
) AS linked
WHERE customer."id" = linked."customerId";

-- Preserve a multi-store legacy identity in quarantine and create one contact
-- snapshot per store. Never infer auth ownership from contact email or phone.
INSERT INTO "Customer" (
  "id", "storeId", "name", "email", "phone", "document", "createdAt", "updatedAt", "isQuarantined", "legacyCustomerId"
)
SELECT 'legacy_' || md5(customer."id" || ':' || linked."storeId"), linked."storeId",
  customer."name", customer."email", customer."phone", customer."document", customer."createdAt", customer."updatedAt",
  false, customer."id"
FROM "Customer" AS customer
JOIN (SELECT DISTINCT "customerId", "storeId" FROM "Order") AS linked ON linked."customerId" = customer."id"
WHERE customer."storeId" IS NULL;

UPDATE "Order" AS orders SET "customerId" = scoped."id"
FROM "Customer" AS scoped
WHERE scoped."legacyCustomerId" = orders."customerId" AND scoped."storeId" = orders."storeId";

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Customer_quarantine_consistent" CHECK (
    ("isQuarantined" AND "storeId" IS NULL AND "authUserId" IS NULL)
    OR (NOT "isQuarantined" AND "storeId" IS NOT NULL)
  );
CREATE UNIQUE INDEX "Customer_id_storeId_key" ON "Customer"("id", "storeId");
CREATE UNIQUE INDEX "Customer_storeId_authUserId_key" ON "Customer"("storeId", "authUserId");
CREATE INDEX "Customer_storeId_phone_idx" ON "Customer"("storeId", "phone");
CREATE INDEX "Customer_legacyCustomerId_idx" ON "Customer"("legacyCustomerId");
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_storeId_fkey"
  FOREIGN KEY ("customerId", "storeId") REFERENCES "Customer"("id", "storeId") ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
