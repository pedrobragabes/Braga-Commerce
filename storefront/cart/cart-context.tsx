"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { cartReducer, sanitizeCartItems, type CartItem } from "./cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  ready: boolean;
  addItem: (item: CartItem) => void;
  updateQuantity: (item: Pick<CartItem, "productId" | "variantId">, quantity: number) => void;
  removeItem: (item: Pick<CartItem, "productId" | "variantId">) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const [ready, setReady] = useState(false);
  const storageKey = `braga-commerce:cart:${storeSlug}:v1`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      dispatch({ type: "replace", items: sanitizeCartItems(stored ? JSON.parse(stored) : []) });
    } catch {
      dispatch({ type: "replace", items: [] });
    } finally {
      setReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready, storageKey]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    ready,
    addItem: (item) => dispatch({ type: "add", item }),
    updateQuantity: (item, quantity) => dispatch({ type: "update", ...item, quantity }),
    removeItem: (item) => dispatch({ type: "remove", ...item }),
    clearCart: () => dispatch({ type: "clear" }),
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser usado dentro de CartProvider.");
  return context;
}
