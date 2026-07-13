import { getDatabase } from "./database";
import type {
  CartQuote,
  CartQuoteLine,
  CheckoutDeliveryMethod,
  CheckoutSettings,
  QuoteRequest,
} from "../storefront/checkout/contracts";

export class CartQuoteError extends Error {
  constructor(
    message: string,
    public readonly code: "STORE_NOT_FOUND" | "INVALID_ITEM" | "DELIVERY_UNAVAILABLE",
    public readonly status = 409,
  ) {
    super(message);
  }
}

function mergeItems(items: QuoteRequest["items"]) {
  return items.reduce<QuoteRequest["items"]>((merged, item) => {
    const existing = merged.find((candidate) =>
      candidate.productId === item.productId && candidate.variantId === item.variantId);
    if (existing) existing.quantity = Math.min(99, existing.quantity + item.quantity);
    else merged.push({ ...item });
    return merged;
  }, []);
}

export async function getCheckoutSettings(storeSlug: string): Promise<CheckoutSettings> {
  const store = await getDatabase().store.findUnique({
    where: { slug: storeSlug },
    select: { settings: { select: { allowLocalPickup: true, allowLocalDelivery: true, localDeliveryFeeCents: true } } },
  });

  if (!store) throw new CartQuoteError("Loja não encontrada.", "STORE_NOT_FOUND", 404);

  return {
    allowLocalPickup: store.settings?.allowLocalPickup ?? true,
    allowLocalDelivery: store.settings?.allowLocalDelivery ?? false,
    localDeliveryFeeCents: store.settings?.localDeliveryFeeCents ?? 0,
  };
}

export async function quoteCart(
  storeSlug: string,
  requestedItems: QuoteRequest["items"],
  deliveryMethod?: CheckoutDeliveryMethod,
): Promise<CartQuote & { storeId: string }> {
  const database = getDatabase();
  const items = mergeItems(requestedItems);
  const store = await database.store.findUnique({
    where: { slug: storeSlug, isActive: true },
    select: {
      id: true,
      settings: { select: { allowLocalPickup: true, allowLocalDelivery: true, localDeliveryFeeCents: true } },
    },
  });

  if (!store) throw new CartQuoteError("Loja indisponível.", "STORE_NOT_FOUND", 404);

  const products = await database.product.findMany({
    where: { id: { in: items.map((item) => item.productId) }, storeId: store.id, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      basePriceCents: true,
      hasVariants: true,
      category: { select: { slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: {
        where: { isActive: true },
        select: { id: true, name: true, sku: true, priceCents: true, stockQuantity: true },
      },
    },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const issues: string[] = [];

  const lines = items.map<CartQuoteLine>((item) => {
    const product = productsById.get(item.productId);
    if (!product) throw new CartQuoteError("Um produto do carrinho não está mais disponível.", "INVALID_ITEM");

    const variant = item.variantId
      ? product.variants.find((candidate) => candidate.id === item.variantId)
      : undefined;

    if (product.hasVariants && !variant) {
      throw new CartQuoteError(`Escolha uma variação válida para ${product.name}.`, "INVALID_ITEM");
    }
    if (!product.hasVariants && item.variantId) {
      throw new CartQuoteError(`A variação informada para ${product.name} é inválida.`, "INVALID_ITEM");
    }

    const stockQuantity = variant?.stockQuantity ?? null;
    const available = stockQuantity === null || stockQuantity >= item.quantity;
    if (!available) issues.push(`${product.name}: apenas ${stockQuantity} unidade(s) disponível(is).`);
    const unitPriceCents = variant?.priceCents ?? product.basePriceCents;

    return {
      productId: product.id,
      ...(variant ? { variantId: variant.id } : {}),
      productName: product.name,
      productSlug: product.slug,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? product.sku,
      categorySlug: product.category?.slug ?? null,
      imageUrl: product.images[0]?.url ?? null,
      quantity: item.quantity,
      stockQuantity,
      unitPriceCents,
      totalCents: unitPriceCents * item.quantity,
      available,
    };
  });

  const settings = {
    allowLocalPickup: store.settings?.allowLocalPickup ?? true,
    allowLocalDelivery: store.settings?.allowLocalDelivery ?? false,
    localDeliveryFeeCents: store.settings?.localDeliveryFeeCents ?? 0,
  };
  if (deliveryMethod === "LOCAL_PICKUP" && !settings.allowLocalPickup) {
    throw new CartQuoteError("Retirada local indisponível.", "DELIVERY_UNAVAILABLE");
  }
  if (deliveryMethod === "LOCAL_DELIVERY" && !settings.allowLocalDelivery) {
    throw new CartQuoteError("Entrega local indisponível.", "DELIVERY_UNAVAILABLE");
  }

  const subtotalCents = lines.reduce((total, line) => total + line.totalCents, 0);
  const shippingCents = deliveryMethod === "LOCAL_DELIVERY" ? settings.localDeliveryFeeCents : 0;

  return {
    storeId: store.id,
    items: lines,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    issues,
  };
}
