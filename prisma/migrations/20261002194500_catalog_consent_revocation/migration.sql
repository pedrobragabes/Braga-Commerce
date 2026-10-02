-- A role/identity change invalidates consent even if an old role is restored
-- with the same millisecond timestamp. It must not silently authorize again.
CREATE FUNCTION revoke_directory_catalog_on_operator_change() RETURNS trigger
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
          "updatedAt" = clock_timestamp()
      WHERE "catalogConsentActorId" = OLD."id" AND "catalogSharingEnabled" = true;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER directory_catalog_operator_changed
AFTER UPDATE OF "role", "isActive", "authUserId", "storeId" OR DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION revoke_directory_catalog_on_operator_change();
