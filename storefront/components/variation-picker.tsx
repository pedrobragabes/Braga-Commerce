"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "../cart/cart-context";
import { formatCurrency, normalizeWhatsapp } from "../format";
import type { StorefrontVariant } from "../types";
import { StoreIcon } from "./icons";

export function VariationPicker({
  productName,
  productId,
  basePriceCents,
  variants,
  whatsapp,
}: {
  productName: string;
  productId: string;
  basePriceCents: number;
  variants: ReadonlyArray<StorefrontVariant>;
  whatsapp: string | null;
}) {
  const { addItem } = useCart();
  const firstAvailable = variants.find((variant) => variant.stockQuantity > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id ?? "");
  const [added, setAdded] = useState(false);
  const selected = variants.find((variant) => variant.id === selectedId) ?? firstAvailable;
  const colors = useMemo(() => [...new Set(variants.map((variant) => variant.color).filter(Boolean))] as string[], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((variant) => variant.size).filter(Boolean))] as string[], [variants]);

  function selectColor(color: string) {
    const match = variants.find((variant) => variant.color === color && variant.size === selected?.size)
      ?? variants.find((variant) => variant.color === color);
    if (match) setSelectedId(match.id);
  }

  function selectSize(size: string) {
    const match = variants.find((variant) => variant.size === size && variant.color === selected?.color)
      ?? variants.find((variant) => variant.size === size);
    if (match) setSelectedId(match.id);
  }

  const phone = normalizeWhatsapp(whatsapp);
  const message = `Olá! Tenho interesse em ${productName}${selected ? ` — ${selected.name}` : ""}.`;
  const contactHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "#contato";
  const selectedPrice = selected?.priceCents ?? basePriceCents;
  const canAdd = variants.length ? Boolean(selected && selected.stockQuantity > 0) : true;

  function handleAdd() {
    if (!canAdd) return;
    addItem({ productId, ...(selected ? { variantId: selected.id } : {}), quantity: 1 });
    setAdded(true);
  }

  return (
    <div className="variation-picker">
      <div className="selected-price"><small>A partir de</small><strong>{formatCurrency(selectedPrice)}</strong></div>
      {colors.length ? <fieldset><legend>Cor</legend><div className="option-row">{colors.map((color) => <button aria-pressed={selected?.color === color} key={color} onClick={() => selectColor(color)} type="button">{color}</button>)}</div></fieldset> : null}
      {sizes.length ? <fieldset><legend>Tamanho</legend><div className="option-row">{sizes.map((size) => <button aria-pressed={selected?.size === size} key={size} onClick={() => selectSize(size)} type="button">{size}</button>)}</div></fieldset> : null}
      <div className="selected-variant">
        <span className={selected && selected.stockQuantity > 0 ? "availability-dot" : "availability-dot unavailable"} />
        {selected ? `${selected.name} · ${selected.stockQuantity > 0 ? `${selected.stockQuantity} em estoque` : "indisponível"}` : "Consulte disponibilidade"}
      </div>
      <button className="primary-button full" disabled={!canAdd} onClick={handleAdd} type="button">
        <StoreIcon name={added ? "check" : "bag"} /> {canAdd ? (added ? "Adicionado ao carrinho" : "Adicionar ao carrinho") : "Variação indisponível"}
      </button>
      {added ? <Link className="secondary-button full" href="/carrinho">Ver carrinho</Link> : null}
      <a className="whatsapp-inline" href={contactHref} rel={phone ? "noreferrer" : undefined} target={phone ? "_blank" : undefined}><StoreIcon name="whatsapp" size={18} /> Tirar dúvida no WhatsApp</a>
      <p className="picker-note">Preço e estoque serão conferidos novamente no checkout.</p>
    </div>
  );
}
