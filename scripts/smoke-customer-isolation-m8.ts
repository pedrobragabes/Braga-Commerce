import "dotenv/config";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../lib/database";
import { buildCustomerOrderScope } from "../lib/customer-orders";

class RollbackSmoke extends Error {
  constructor(readonly evidence: Record<string, boolean>) {
    super("ROLLBACK_SMOKE");
  }
}

async function main() {
  const database = getDatabase();
  const baseStore = await database.store.findFirst({ select: { id: true } });
  if (!baseStore) throw new Error("AUTH_SMOKE_STORE_MISSING");
  const suffix = randomUUID();
  const accountEmail = `account-a-${suffix}@example.test`;
  const otherEmail = `account-b-${suffix}@example.test`;

  try {
    await database.$transaction(async (transaction) => {
      const otherStore = await transaction.store.create({
        data: { name: "M8 Isolation Smoke", slug: `m8-isolation-${suffix}` },
      });
      const [accountCustomer, otherCustomer, otherStoreCustomer] = await Promise.all([
        transaction.customer.create({
          data: {
            storeId: baseStore.id,
            name: "Account A",
            email: accountEmail,
            phone: `5511${suffix.replaceAll("-", "").slice(0, 9)}`,
          },
        }),
        transaction.customer.create({
          data: {
            storeId: baseStore.id,
            name: "Account B",
            email: otherEmail,
            phone: `5521${suffix.replaceAll("-", "").slice(0, 9)}`,
          },
        }),
        transaction.customer.create({
          data: {
            storeId: otherStore.id,
            name: "Account A Other Store",
            email: accountEmail,
            phone: `5531${suffix.replaceAll("-", "").slice(0, 9)}`,
          },
        }),
      ]);

      const orderData = (storeId: string, customerId: string, email: string) => ({
        storeId,
        customerId,
        subtotalCents: 1000,
        totalCents: 1000,
        customerName: "M8 Smoke",
        customerPhone: "5511999999999",
        customerEmail: email,
      });
      const [visibleOrder, otherAccountOrder, otherStoreOrder] = await Promise.all([
        transaction.order.create({
          data: orderData(baseStore.id, accountCustomer.id, accountEmail.toUpperCase()),
        }),
        transaction.order.create({
          data: orderData(baseStore.id, otherCustomer.id, otherEmail),
        }),
        transaction.order.create({
          data: orderData(otherStore.id, otherStoreCustomer.id, accountEmail),
        }),
      ]);

      const visible = await transaction.order.findMany({
        where: buildCustomerOrderScope(baseStore.id, accountEmail),
        select: { id: true },
      });
      const ids = new Set(visible.map((order) => order.id));
      const evidence = {
        sameStoreSameEmailVisible: ids.has(visibleOrder.id),
        otherEmailHidden: !ids.has(otherAccountOrder.id),
        otherStoreHidden: !ids.has(otherStoreOrder.id),
        caseInsensitiveMatch: ids.has(visibleOrder.id),
      };
      if (Object.values(evidence).some((value) => !value)) {
        throw new Error("CUSTOMER_ORDER_ISOLATION_FAILED");
      }
      throw new RollbackSmoke(evidence);
    });
  } catch (error) {
    if (error instanceof RollbackSmoke) {
      console.info(JSON.stringify({ ...error.evidence, fixturesRolledBack: true }));
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "CUSTOMER_ISOLATION_SMOKE_FAILED");
  process.exitCode = 1;
});
