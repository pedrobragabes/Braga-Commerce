export type CartItem = {
  productId: string;
  variantId?: string;
  quantity: number;
};

export type CartAction =
  | { type: "replace"; items: CartItem[] }
  | { type: "add"; item: CartItem }
  | { type: "update"; productId: string; variantId?: string; quantity: number }
  | { type: "remove"; productId: string; variantId?: string }
  | { type: "clear" };

function itemKey(item: Pick<CartItem, "productId" | "variantId">) {
  return `${item.productId}:${item.variantId ?? "simple"}`;
}

function clampQuantity(quantity: number) {
  return Math.max(1, Math.min(99, Math.trunc(quantity)));
}

export function sanitizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  const sanitized = value.flatMap((item): CartItem[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.productId !== "string" || !candidate.productId) return [];
    if (candidate.variantId !== undefined && typeof candidate.variantId !== "string") return [];
    if (typeof candidate.quantity !== "number" || !Number.isFinite(candidate.quantity)) return [];

    return [{
      productId: candidate.productId,
      ...(candidate.variantId ? { variantId: candidate.variantId } : {}),
      quantity: clampQuantity(candidate.quantity),
    }];
  });

  return sanitized.reduce<CartItem[]>((items, item) => {
    const existing = items.find((candidate) => itemKey(candidate) === itemKey(item));
    if (existing) existing.quantity = clampQuantity(existing.quantity + item.quantity);
    else items.push({ ...item });
    return items;
  }, []);
}

export function cartReducer(items: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case "replace":
      return sanitizeCartItems(action.items);
    case "add": {
      const existing = items.find((item) => itemKey(item) === itemKey(action.item));
      if (!existing) return [...items, { ...action.item, quantity: clampQuantity(action.item.quantity) }];
      return items.map((item) => itemKey(item) === itemKey(action.item)
        ? { ...item, quantity: clampQuantity(item.quantity + action.item.quantity) }
        : item);
    }
    case "update":
      return items.map((item) => itemKey(item) === itemKey(action)
        ? { ...item, quantity: clampQuantity(action.quantity) }
        : item);
    case "remove":
      return items.filter((item) => itemKey(item) !== itemKey(action));
    case "clear":
      return [];
  }
}
