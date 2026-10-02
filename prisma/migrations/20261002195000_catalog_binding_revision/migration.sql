-- Opaque CAS revision prevents old consent screens from matching a new binding
-- merely because timestamps happen to be equal. New rows always get a nonce.
ALTER TABLE "StoreDirectoryBinding"
  ADD COLUMN "catalogConsentRevision" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE OR REPLACE FUNCTION revoke_directory_catalog_on_operator_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR ROW(OLD."role", OLD."isActive", OLD."authUserId", OLD."storeId")
      IS DISTINCT FROM ROW(NEW."role", NEW."isActive", NEW."authUserId", NEW."storeId") THEN
    UPDATE "StoreDirectoryBinding"
      SET "catalogSharingEnabled" = false,
          "catalogConsentActorId" = NULL,
          "catalogConsentActorUpdatedAt" = NULL,
          "catalogConsentAt" = NULL,
          "catalogConsentScopeVersion" = NULL,
          "catalogConsentRevision" = gen_random_uuid()::text,
          "updatedAt" = clock_timestamp()
      WHERE "catalogConsentActorId" = OLD."id" AND "catalogSharingEnabled" = true;
  END IF;
  RETURN NULL;
END;
$$;
