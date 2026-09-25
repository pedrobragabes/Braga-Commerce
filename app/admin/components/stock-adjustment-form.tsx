"use client";

import { useActionState } from "react";
import { adjustStock } from "../actions";

export function StockAdjustmentForm({ productId, variantId, quantity, requestId }: {
  productId: string; variantId?: string; quantity: number; requestId: string;
}) {
  const [state, action, pending] = useActionState(adjustStock, {});
  return <form action={action} className="admin-form-card admin-stock-adjustment">
    <input name="productId" type="hidden" value={productId} />
    <input name="variantId" type="hidden" value={variantId ?? ""} />
    <input name="expectedQuantity" type="hidden" value={quantity} />
    <input name="requestId" type="hidden" value={requestId} />
    <p>Saldo disponível: <strong>{quantity}</strong> unidade(s). Reservas de pedidos já foram descontadas.</p>
    <div className="admin-form-grid">
      <label><span>Adicionar ou retirar unidades</span><input name="delta" type="number" step="1" required placeholder="Ex.: 5 ou -2" disabled={pending} /></label>
      <label><span>Motivo do ajuste</span><input name="reason" minLength={3} maxLength={500} required placeholder="Ex.: entrada de mercadoria conferida" disabled={pending} /></label>
    </div>
    {state.error ? <p className="admin-alert" role="alert">{state.error}</p> : null}
    {state.success ? <p className="admin-alert success" role="status">Ajuste registrado.</p> : null}
    <button className="admin-button compact" disabled={pending} type="submit">{pending ? "Registrando…" : "Registrar ajuste"}</button>
  </form>;
}
