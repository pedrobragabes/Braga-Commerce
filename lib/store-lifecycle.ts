import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { CartQuoteError } from "./cart-quote";

export class StoreLifecycleError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export async function lockStore(transaction: Prisma.TransactionClient, storeId: string) {
  // NO KEY UPDATE serializes access decisions without blocking FK KEY SHARE
  // checks from stock audit/outbox writes that already hold product/order locks.
  await transaction.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR NO KEY UPDATE`;
}

export async function requirePlatformOperator(transaction: Prisma.TransactionClient, authUserId: string) {
  if (!authUserId || !await transaction.platformOperator.findFirst({ where: { authUserId, isActive: true } })) {
    throw new StoreLifecycleError("FORBIDDEN");
  }
}

export function subscriptionAllowsCheckout(subscription: {
  status: string; startsAt: Date | null; endsAt: Date | null; plan: { checkoutEnabled: boolean };
} | null, now = new Date()) {
  return Boolean(subscription && ["ACTIVE", "ENDING"].includes(subscription.status)
    && subscription.startsAt && subscription.endsAt && subscription.startsAt <= now
    && now < subscription.endsAt && subscription.plan.checkoutEnabled);
}

export async function canStoreReceiveOrders(storeId: string) {
  const store = await getDatabase().store.findUnique({ where: { id: storeId }, include: { subscription: { include: { plan: true } } } });
  return Boolean(store?.isActive && (store.salesAccessMode === "LEGACY_PILOT" && !store.subscription || subscriptionAllowsCheckout(store.subscription)));
}

// The same row lock is used by subscription changes and order creation. A
// cancellation cannot race between this check and reservation/commit.
export async function assertNewPurchasesAllowed(transaction: Prisma.TransactionClient, storeId: string) {
  await lockStore(transaction, storeId);
  const store = await transaction.store.findUnique({
    where: { id: storeId }, include: { subscription: { include: { plan: true } } },
  });
  const allowed = store?.isActive && (store.salesAccessMode === "LEGACY_PILOT" && !store.subscription
    || subscriptionAllowsCheckout(store.subscription));
  if (!allowed) throw new CartQuoteError("Esta loja não está recebendo novas compras agora.", "STORE_UNAVAILABLE", 409);
}

const planSchema = z.object({ code: z.string().regex(/^[a-z0-9-]{2,50}$/), version: z.number().int().positive(),
  name: z.string().trim().min(2).max(100), conditions: z.string().trim().min(20).max(10000),
  priceCents: z.number().int().nonnegative().nullable(), isPublished: z.boolean(), checkoutEnabled: z.boolean(),
}).strict();

export async function createPlanVersion(authUserId: string, input: unknown) {
  const data = planSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    await requirePlatformOperator(transaction, authUserId);
    return transaction.plan.create({ data: { ...data, createdBy: authUserId } });
  });
}

const applicationSchema = z.object({ requestKey: z.uuid(), storeName: z.string().trim().min(2).max(100),
  storeSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(70), planId: z.string().min(1).max(80).nullable(),
  acceptedPlanVersion: z.number().int().positive().nullable(),
}).strict();
const identitySchema = z.object({ authUserId: z.string().min(1).max(80), name: z.string().trim().min(1).max(120), email: z.email() });

export async function requestStore(identity: z.infer<typeof identitySchema>, input: unknown) {
  const person = identitySchema.parse(identity);
  const data = applicationSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.requestKey}, 0))`;
    const existing = await transaction.storeApplication.findUnique({ where: { requestKey: data.requestKey } });
    if (existing) {
      if (existing.requesterAuthUserId !== person.authUserId || existing.storeName !== data.storeName
        || existing.storeSlug !== data.storeSlug || existing.planId !== data.planId
        || existing.acceptedPlanVersion !== data.acceptedPlanVersion) throw new StoreLifecycleError("IDEMPOTENCY_CONFLICT");
      return existing;
    }
    if (data.planId) {
      const plan = await transaction.plan.findFirst({ where: { id: data.planId, version: data.acceptedPlanVersion ?? -1, isPublished: true } });
      if (!plan) throw new StoreLifecycleError("PLAN_NOT_AVAILABLE");
    } else if (data.acceptedPlanVersion !== null) throw new StoreLifecycleError("INVALID_TERMS");
    return transaction.storeApplication.create({ data: { ...data, requesterAuthUserId: person.authUserId,
      requesterName: person.name, requesterEmail: person.email, acceptedAt: data.planId ? new Date() : null } });
  });
}

export async function provisionStore(authUserId: string, applicationId: string) {
  return getDatabase().$transaction(async (transaction) => {
    await requirePlatformOperator(transaction, authUserId);
    await transaction.$queryRaw`SELECT "id" FROM "StoreApplication" WHERE "id" = ${applicationId} FOR UPDATE`;
    const request = await transaction.storeApplication.findUnique({ where: { id: applicationId }, include: { plan: true } });
    if (!request) throw new StoreLifecycleError("APPLICATION_NOT_FOUND");
    if (request.status === "PROVISIONED") return transaction.store.findUniqueOrThrow({ where: { id: request.storeId! } });
    if (request.status !== "REQUESTED" || !request.plan || !request.acceptedAt
      || request.acceptedPlanVersion !== request.plan.version) throw new StoreLifecycleError("TERMS_REQUIRED");
    if (await transaction.store.findUnique({ where: { slug: request.storeSlug } })) throw new StoreLifecycleError("SLUG_IN_USE");
    const store = await transaction.store.create({ data: { name: request.storeName, slug: request.storeSlug,
      salesAccessMode: "ASSISTED", settings: { create: {} },
      users: { create: { authUserId: request.requesterAuthUserId, name: request.requesterName, email: request.requesterEmail, role: "OWNER" } },
      subscription: { create: { planId: request.plan.id, acceptedPlanVersion: request.plan.version,
        acceptedAt: request.acceptedAt, acceptedBy: request.requesterAuthUserId } },
      auditEvents: { create: { actorId: authUserId, action: "STORE_PROVISIONED", reference: request.id } },
    } });
    await transaction.storeApplication.update({ where: { id: request.id }, data: {
      status: "PROVISIONED", storeId: store.id, decidedBy: authUserId, decidedAt: new Date(),
    } });
    return store;
  });
}

export async function acceptApplicationPlan(authUserId: string, applicationId: string, planId: string) {
  if (!authUserId) throw new StoreLifecycleError("FORBIDDEN");
  return getDatabase().$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "StoreApplication" WHERE "id" = ${applicationId} FOR UPDATE`;
    const request = await transaction.storeApplication.findFirst({ where: { id: applicationId, requesterAuthUserId: authUserId, status: "REQUESTED" } });
    const plan = await transaction.plan.findFirst({ where: { id: planId, isPublished: true } });
    if (!request || !plan) throw new StoreLifecycleError("PLAN_NOT_AVAILABLE");
    return transaction.storeApplication.update({ where: { id: request.id }, data: { planId, acceptedPlanVersion: plan.version, acceptedAt: new Date() } });
  });
}

export async function rejectStoreApplication(authUserId: string, applicationId: string, reason: string) {
  const note = z.string().trim().min(5).max(500).parse(reason);
  return getDatabase().$transaction(async (transaction) => {
    await requirePlatformOperator(transaction, authUserId);
    const updated = await transaction.storeApplication.updateMany({ where: { id: applicationId, status: "REQUESTED" }, data: {
      status: "REJECTED", decidedBy: authUserId, decidedAt: new Date(), decisionReason: note,
    } });
    if (updated.count !== 1) throw new StoreLifecycleError("APPLICATION_CHANGED");
  });
}

export async function assignStoreDomain(authUserId: string, storeId: string, input: string) {
  const domain = z.string().trim().toLowerCase().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/).max(253).parse(input);
  if (!(process.env.STORE_PUBLIC_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).includes(domain)) throw new StoreLifecycleError("DOMAIN_NOT_ALLOWED");
  return getDatabase().$transaction(async (transaction) => {
    await requirePlatformOperator(transaction, authUserId);
    await lockStore(transaction, storeId);
    await transaction.store.update({ where: { id: storeId }, data: { domain } });
    await transaction.storeAuditEvent.create({ data: { storeId, actorId: authUserId, action: "DOMAIN_ASSIGNED", reference: domain } });
  });
}

const subscriptionSchema = z.object({ storeId: z.string().min(1).max(80), expectedRevision: z.number().int().nonnegative(),
  status: z.enum(["PENDING", "ACTIVE", "ENDING", "CANCELLED", "SUSPENDED"]),
  startsAt: z.date().nullable(), endsAt: z.date().nullable(),
  activationOrigin: z.enum(["ADMINISTRATIVE", "COURTESY", "EXTERNAL_CONFIRMATION"]).nullable(),
  confirmationReference: z.string().trim().regex(/^[A-Za-z0-9_.:-]{1,120}$/).nullable(),
  reason: z.string().trim().min(5).max(500),
}).strict().superRefine((data, context) => {
  if (Boolean(data.startsAt) !== Boolean(data.endsAt) || data.startsAt && data.endsAt && data.endsAt <= data.startsAt)
    context.addIssue({ code: "custom", message: "Informe início e fim válidos do mesmo período." });
  if (["ACTIVE", "ENDING"].includes(data.status) && (!data.startsAt || !data.endsAt
    || data.endsAt <= data.startsAt || !data.activationOrigin)) context.addIssue({ code: "custom", message: "Período e origem obrigatórios." });
  if (data.activationOrigin === "EXTERNAL_CONFIRMATION" && !data.confirmationReference)
    context.addIssue({ code: "custom", message: "Informe uma referência técnica de confirmação." });
});

export async function changeSubscription(authUserId: string, input: unknown) {
  const data = subscriptionSchema.parse(input);
  return getDatabase().$transaction(async (transaction) => {
    await requirePlatformOperator(transaction, authUserId);
    await lockStore(transaction, data.storeId);
    const current = await transaction.subscription.findUnique({ where: { storeId: data.storeId } });
    if (!current || current.revision !== data.expectedRevision) throw new StoreLifecycleError("SUBSCRIPTION_CHANGED");
    if (data.status === "ENDING" && current.status !== "ACTIVE") throw new StoreLifecycleError("INVALID_TRANSITION");
    const { expectedRevision: _, reason, storeId, ...changes } = data;
    void _;
    const updated = await transaction.subscription.update({ where: { id: current.id }, data: {
      ...changes, confirmedBy: authUserId, revision: { increment: 1 },
    } });
    await transaction.storeAuditEvent.create({ data: { storeId, actorId: authUserId,
      action: `SUBSCRIPTION_${data.status}`, reference: `${current.id}:${updated.revision}`, reason } });
    return updated;
  });
}
