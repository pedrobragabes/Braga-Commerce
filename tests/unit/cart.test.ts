import { describe, expect, it } from "vitest";
import { cartReducer, sanitizeCartItems } from "../../storefront/cart/cart";
import { checkoutRequestSchema, quoteRequestSchema } from "../../storefront/checkout/contracts";

describe("carrinho", () => {
  it("mantém apenas identificadores e quantidade e soma itens iguais", () => {
    const first = cartReducer([], { type: "add", item: { productId: "p1", variantId: "v1", quantity: 1 } });
    const second = cartReducer(first, { type: "add", item: { productId: "p1", variantId: "v1", quantity: 2 } });

    expect(second).toEqual([{ productId: "p1", variantId: "v1", quantity: 3 }]);
    expect(quoteRequestSchema.safeParse({
      storeSlug: "pv-moda-masculina",
      items: [{ productId: "p1", variantId: "v1", quantity: 1, priceCents: 1 }],
    }).success).toBe(false);
  });

  it("descarta rascunhos inválidos vindos do localStorage", () => {
    expect(sanitizeCartItems([{ productId: "p1", quantity: 2 }, { price: 10 }]))
      .toEqual([{ productId: "p1", quantity: 2 }]);
  });
});

describe("checkout convidado", () => {
  const base = {
    storeSlug: "pv-moda-masculina",
    items: [{ productId: "p1", variantId: "v1", quantity: 1 }],
    customer: { name: "Pedro Braga", phone: "16999999999", email: "" },
    deliveryMethod: "LOCAL_PICKUP" as const,
  };

  it("aceita retirada sem login e sem endereço", () => {
    expect(checkoutRequestSchema.safeParse(base).success).toBe(true);
  });

  it("exige endereço completo para entrega local", () => {
    const result = checkoutRequestSchema.safeParse({ ...base, deliveryMethod: "LOCAL_DELIVERY" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.join(".") === "address.zipCode")).toBe(true);
  });
});
