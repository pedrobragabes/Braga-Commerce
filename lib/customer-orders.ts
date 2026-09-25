import type { Prisma } from "../generated/prisma/client";

export function buildCustomerOrderScope(storeId: string, authUserId: string) {
  if (!storeId || !authUserId) throw new Error("CUSTOMER_IDENTITY_REQUIRED");
  return {
    storeId,
    customer: { is: { storeId, authUserId, isQuarantined: false } },
  } satisfies Prisma.OrderWhereInput;
}
