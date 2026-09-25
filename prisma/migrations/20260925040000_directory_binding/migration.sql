CREATE TABLE "StoreDirectoryBinding" (
  "id" TEXT PRIMARY KEY,
  "storeId" TEXT NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "commerceId" INTEGER NOT NULL CHECK ("commerceId" > 0),
  "origin" TEXT NOT NULL,
  "challengeHash" TEXT NOT NULL CHECK ("challengeHash" ~ '^[0-9a-f]{64}$'),
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("origin", "commerceId")
);
