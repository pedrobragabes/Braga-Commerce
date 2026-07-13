"use client";

import { useEffect, useState } from "react";
import type { CartQuote } from "../checkout/contracts";
import { useCart } from "./cart-context";

export function useCartQuote(storeSlug: string) {
  const { items, ready } = useCart();
  const requestKey = JSON.stringify(items);
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; error: string | null }>({
    key: "",
    quote: null,
    error: null,
  });

  useEffect(() => {
    if (!ready || !items.length) return;

    const controller = new AbortController();

    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeSlug, items }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível revisar o carrinho.");
        return payload as CartQuote;
      })
      .then((quote) => setResult({ key: requestKey, quote, error: null }))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setResult({
          key: requestKey,
          quote: null,
          error: requestError instanceof Error ? requestError.message : "Não foi possível revisar o carrinho.",
        });
      });

    return () => controller.abort();
  }, [items, ready, requestKey, storeSlug]);

  const current = ready && items.length > 0 && result.key === requestKey;
  return {
    quote: current ? result.quote : null,
    error: current ? result.error : null,
    loading: ready && items.length > 0 && !current,
  };
}
