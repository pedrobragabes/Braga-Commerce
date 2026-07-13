"use client";

import Link from "next/link";
import { useCart } from "./cart-context";
import { StoreIcon } from "../components/icons";

export function CartLink() {
  const { itemCount, ready } = useCart();

  return (
    <Link aria-label={`Carrinho com ${itemCount} item(ns)`} className="cart-link" href="/carrinho">
      <StoreIcon name="bag" />
      <span>Carrinho</span>
      <strong aria-live="polite">{ready ? itemCount : 0}</strong>
    </Link>
  );
}
