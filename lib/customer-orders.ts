import type { Prisma } from "../generated/prisma/client";

export function buildCustomerOrderScope(storeId: string, verifiedEmail: string) {
  return {
    storeId,
    customerEmail: { equals: verifiedEmail.trim().toLowerCase(), mode: "insensitive" },
  } satisfies Prisma.OrderWhereInput;
}
