-- Existing v1 bindings remain links only; no implicit product consent.
ALTER TABLE "StoreDirectoryBinding"
  ADD COLUMN "catalogSharingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "catalogConsentActorId" TEXT,
  ADD COLUMN "catalogConsentActorUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "catalogConsentAt" TIMESTAMP(3),
  ADD COLUMN "catalogConsentScopeVersion" INTEGER;

ALTER TABLE "StoreDirectoryBinding" ADD CONSTRAINT "directory_catalog_consent_complete"
  CHECK (NOT "catalogSharingEnabled" OR (
    "catalogConsentActorId" IS NOT NULL AND "catalogConsentActorUpdatedAt" IS NOT NULL
    AND "catalogConsentAt" IS NOT NULL AND "catalogConsentScopeVersion" IS NOT NULL AND "catalogConsentScopeVersion" = 2
  ));
