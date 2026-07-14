import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getDatabase } from "../lib/database";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "../lib/supabase/config";

const database = getDatabase();
const command = process.argv[2];
const runId = process.env.M4_SMOKE_RUN_ID?.trim();
const password = process.env.M4_SMOKE_PASSWORD;
const pilotStoreSlug = process.env.SEED_STORE_SLUG || "pv-moda-masculina";

if (!runId || !/^[a-z0-9-]{6,40}$/.test(runId)) {
  throw new Error("Configure M4_SMOKE_RUN_ID com 6 a 40 caracteres seguros.");
}

const secondStoreSlug = `m4-smoke-${runId}`;
const emails = {
  owner: `m4-owner-${runId}@example.com`,
  admin: `m4-admin-${runId}@example.com`,
  staff: `m4-staff-${runId}@example.com`,
  secondOwner: `m4-second-${runId}@example.com`,
};

function getSupabaseAdmin() {
  const { url } = getSupabasePublicConfig();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createOperator(
  email: string,
  name: string,
  role: "OWNER" | "ADMIN" | "STAFF",
  storeId: string,
  createdAuthIds: string[],
) {
  if (!password || password.length < 12) {
    throw new Error("Configure M4_SMOKE_PASSWORD com ao menos 12 caracteres.");
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "m4-smoke" },
  });
  if (error || !data.user) throw new Error(error?.message || "Falha ao criar identidade temporária.");
  createdAuthIds.push(data.user.id);
  await database.user.create({
    data: { authUserId: data.user.id, storeId, name, email, role },
  });
}

async function setup() {
  const createdAuthIds: string[] = [];
  const pilotStore = await database.store.findUnique({ where: { slug: pilotStoreSlug } });
  if (!pilotStore) throw new Error("Loja piloto não encontrada.");

  const product = await database.product.findFirst({
    where: { storeId: pilotStore.id, isActive: true },
    include: { variants: { where: { isActive: true }, take: 1 } },
  });
  if (!product) throw new Error("Produto ativo da loja piloto não encontrado.");
  const variant = product.hasVariants ? product.variants[0] : null;
  if (product.hasVariants && !variant) throw new Error("Produto piloto sem variação ativa.");

  const secondStore = await database.store.create({
    data: {
      name: "Loja temporária M4",
      slug: secondStoreSlug,
      settings: { create: { allowLocalPickup: true, allowLocalDelivery: false } },
    },
  });

  try {
    await createOperator(emails.owner, "Owner temporário M4", "OWNER", pilotStore.id, createdAuthIds);
    await createOperator(emails.admin, "Admin temporário M4", "ADMIN", pilotStore.id, createdAuthIds);
    await createOperator(emails.staff, "Staff temporário M4", "STAFF", pilotStore.id, createdAuthIds);
    await createOperator(
      emails.secondOwner,
      "Owner segunda loja M4",
      "OWNER",
      secondStore.id,
      createdAuthIds,
    );

    const unitPriceCents = variant?.priceCents ?? product.basePriceCents;
    const customer = await database.customer.create({
      data: { name: `Teste técnico M4 ${runId}`, phone: "00000000000" },
    });
    const order = await database.order.create({
      data: {
        storeId: pilotStore.id,
        customerId: customer.id,
        status: "PENDING",
        paymentStatus: "WAITING_PAYMENT",
        fulfillmentStatus: "NOT_FULFILLED",
        subtotalCents: unitPriceCents,
        totalCents: unitPriceCents,
        deliveryMethod: "LOCAL_PICKUP",
        customerName: `Teste técnico M4 ${runId}`,
        customerPhone: "00000000000",
        items: {
          create: {
            productId: product.id,
            variantId: variant?.id,
            productName: product.name,
            variantName: variant?.name,
            sku: variant?.sku ?? product.sku,
            quantity: 1,
            unitPriceCents,
            totalCents: unitPriceCents,
          },
        },
      },
    });

    console.info(JSON.stringify({
      runId,
      secondStoreId: secondStore.id,
      secondStoreSlug,
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
    }));
  } catch (error) {
    const supabase = getSupabaseAdmin();
    await Promise.allSettled(createdAuthIds.map((id) => supabase.auth.admin.deleteUser(id)));
    await database.store.delete({ where: { id: secondStore.id } });
    throw error;
  }
}

async function verify() {
  const orderId = process.env.M4_SMOKE_ORDER_ID?.trim();
  if (!orderId) throw new Error("Configure M4_SMOKE_ORDER_ID.");
  const order = await database.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, fulfillmentStatus: true, internalNote: true },
  });
  if (!order) throw new Error("Pedido temporário não encontrado.");
  console.info(JSON.stringify({
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    hasInternalNote: Boolean(order.internalNote),
  }));
}

async function cleanup() {
  const supabase = getSupabaseAdmin();
  const operators = await database.user.findMany({
    where: { email: { in: Object.values(emails) } },
    select: { id: true, authUserId: true },
  });
  for (const operator of operators) {
    if (operator.authUserId) {
      const { error } = await supabase.auth.admin.deleteUser(operator.authUserId);
      if (error) throw new Error("Falha ao remover identidade temporária.");
    }
  }
  await database.user.deleteMany({ where: { id: { in: operators.map((operator) => operator.id) } } });

  const orders = await database.order.findMany({
    where: { customerName: `Teste técnico M4 ${runId}` },
    select: { id: true, customerId: true },
  });
  if (orders.length) {
    await database.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
    await database.customer.deleteMany({ where: { id: { in: orders.map((order) => order.customerId) } } });
  }

  await database.product.deleteMany({
    where: { store: { slug: pilotStoreSlug }, slug: { startsWith: secondStoreSlug } },
  });
  await database.category.deleteMany({
    where: { store: { slug: pilotStoreSlug }, slug: { startsWith: secondStoreSlug } },
  });
  await database.store.deleteMany({ where: { slug: secondStoreSlug } });

  const [remainingOperators, remainingOrders, remainingProducts, remainingCategories, remainingStores] =
    await Promise.all([
      database.user.count({ where: { email: { in: Object.values(emails) } } }),
      database.order.count({ where: { customerName: `Teste técnico M4 ${runId}` } }),
      database.product.count({
        where: { store: { slug: pilotStoreSlug }, slug: { startsWith: secondStoreSlug } },
      }),
      database.category.count({
        where: { store: { slug: pilotStoreSlug }, slug: { startsWith: secondStoreSlug } },
      }),
      database.store.count({ where: { slug: secondStoreSlug } }),
    ]);
  const remaining =
    remainingOperators + remainingOrders + remainingProducts + remainingCategories + remainingStores;
  if (remaining !== 0) throw new Error("A limpeza do smoke M4 deixou registros temporários.");
  console.info(JSON.stringify({ cleaned: true, runId }));
}

async function main() {
  if (command === "setup") await setup();
  else if (command === "verify") await verify();
  else if (command === "cleanup") await cleanup();
  else throw new Error("Use setup, verify ou cleanup.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falha no smoke M4.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
