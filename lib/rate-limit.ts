import { createHmac } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getDatabase } from "./database";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowSeconds: number;
};

export const rateLimitPolicies = {
  quote: { name: "quote", limit: 60, windowSeconds: 300 },
  order: { name: "order", limit: 10, windowSeconds: 900 },
  preference: { name: "preference", limit: 10, windowSeconds: 900 },
  orderStatus: { name: "order-status", limit: 60, windowSeconds: 300 },
  betaPassword: { name: "beta-password", limit: 10, windowSeconds: 900 },
  adminLoginIp: { name: "admin-login-ip", limit: 30, windowSeconds: 900 },
  adminLoginAccount: { name: "admin-login-account", limit: 8, windowSeconds: 900 },
} satisfies Record<string, RateLimitPolicy>;

export class RateLimitConfigurationError extends Error {}

function getRateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "braga-commerce-local-rate-limit";
  throw new RateLimitConfigurationError("RATE_LIMIT_SECRET não configurado.");
}

export function getClientAddressFromHeaders(headers: Pick<Headers, "get">) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function getClientAddress(request: Request) {
  return getClientAddressFromHeaders(request.headers);
}

export function createRateLimitKey(
  policyName: string,
  identifier: string,
  secret = getRateLimitSecret(),
) {
  return createHmac("sha256", secret).update(`${policyName}:${identifier}`).digest("hex");
}

export async function checkRateLimitIdentifier(identifier: string, policy: RateLimitPolicy) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.windowSeconds * 1000);
  const key = createRateLimitKey(policy.name, identifier);
  const rows = await getDatabase().$queryRaw<Array<{ count: number; expiresAt: Date }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `);
  const bucket = rows[0];
  const retryAfter = Math.max(
    1,
    Math.ceil(((bucket?.expiresAt ?? expiresAt).getTime() - now.getTime()) / 1000),
  );
  return { allowed: Boolean(bucket && bucket.count <= policy.limit), retryAfter };
}

export async function checkRateLimit(request: Request, policy: RateLimitPolicy) {
  return checkRateLimitIdentifier(getClientAddress(request), policy);
}

export async function enforceRateLimit(request: Request, policy: RateLimitPolicy) {
  try {
    const result = await checkRateLimit(request, policy);
    if (result.allowed) return null;
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde e tente novamente." } },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfter), "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "PROTECTION_UNAVAILABLE",
          message: "Proteção temporariamente indisponível.",
        },
      },
      { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
    );
  }
}
