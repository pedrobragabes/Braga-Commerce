import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./database";
import { lockStore, StoreLifecycleError } from "./store-lifecycle";
import { can } from "./admin-auth";

const inputSchema = z.object({ enabled: z.boolean(), scopeVersion: z.literal(2), expectedRevision: z.uuid() }).strict();

export function catalogConsentCurrent(binding: {
  catalogSharingEnabled: boolean; catalogConsentScopeVersion: number | null; catalogConsentAt: Date | null;
  catalogConsentActorUpdatedAt: Date | null;
} | null, operator: { isActive: boolean; role: string; updatedAt: Date } | null) {
  return Boolean(binding?.catalogSharingEnabled && binding.catalogConsentScopeVersion === 2 && binding.catalogConsentAt
    && operator?.isActive && operator.role === "OWNER" && operator.updatedAt.getTime() === binding.catalogConsentActorUpdatedAt?.getTime());
}

export async function setCatalogSharing(actor: { userId: string; storeId: string }, input: unknown) {
  const data = inputSchema.parse(input);
  return getDatabase().$transaction(async transaction => {
    await lockStore(transaction, actor.storeId);
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId} AND "storeId" = ${actor.storeId} FOR SHARE`;
    const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
    if (!operator || !can(operator.role, "settings:write") || data.enabled && operator.role !== "OWNER") throw new StoreLifecycleError("FORBIDDEN");
    const binding = await transaction.storeDirectoryBinding.findUnique({ where: { storeId: actor.storeId } });
    if (!binding) throw new StoreLifecycleError("DIRECTORY_BINDING_REQUIRED");
    if (binding.catalogConsentRevision !== data.expectedRevision) throw new StoreLifecycleError("DIRECTORY_BINDING_CHANGED");
    const updated = await transaction.storeDirectoryBinding.update({ where: { id: binding.id }, data: {
      catalogSharingEnabled: data.enabled,
      catalogConsentActorId: data.enabled ? operator.id : null,
      catalogConsentActorUpdatedAt: data.enabled ? operator.updatedAt : null,
      catalogConsentAt: data.enabled ? new Date() : null,
      catalogConsentScopeVersion: data.enabled ? 2 : null,
      catalogConsentRevision: randomUUID(),
    } });
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId,
      action: data.enabled ? "DIRECTORY_CATALOG_ENABLED" : "DIRECTORY_CATALOG_DISABLED", reference: `${binding.id}:2` } });
    return { enabled: updated.catalogSharingEnabled, revision: updated.catalogConsentRevision };
  });
}
