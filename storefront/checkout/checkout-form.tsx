"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useCart } from "../cart/cart-context";
import { useCartQuote } from "../cart/use-cart-quote";
import { StoreIcon } from "../components/icons";
import { formatCurrency } from "../format";
import type { CheckoutDeliveryMethod, CheckoutSettings } from "./contracts";

type CheckoutFormProps = { storeSlug: string; settings: CheckoutSettings };

export function CheckoutForm({ storeSlug, settings }: CheckoutFormProps) {
  const router = useRouter();
  const { items, ready, clearCart } = useCart();
  const { quote, error: quoteError, loading } = useCartQuote(storeSlug);
  const firstMethod: CheckoutDeliveryMethod = settings.allowLocalPickup ? "LOCAL_PICKUP" : "LOCAL_DELIVERY";
  const [deliveryMethod, setDeliveryMethod] = useState<CheckoutDeliveryMethod>(firstMethod);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!ready || loading) return <div className="cart-loading">Preparando checkout…</div>;
  if (!items.length) {
    return <div className="checkout-empty"><h1>Seu carrinho está vazio.</h1><p>Adicione uma peça antes de preencher o checkout.</p><Link className="primary-button" href="/produtos">Ver produtos</Link></div>;
  }

  const shippingCents = deliveryMethod === "LOCAL_DELIVERY" ? settings.localDeliveryFeeCents : 0;
  const totalCents = (quote?.subtotalCents ?? 0) + shippingCents;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const formData = new FormData(event.currentTarget);
    const address = deliveryMethod === "LOCAL_DELIVERY" ? {
      zipCode: String(formData.get("zipCode") ?? ""),
      street: String(formData.get("street") ?? ""),
      number: String(formData.get("number") ?? ""),
      complement: String(formData.get("complement") ?? ""),
      neighborhood: String(formData.get("neighborhood") ?? ""),
      city: String(formData.get("city") ?? ""),
      state: String(formData.get("state") ?? ""),
    } : undefined;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          items,
          customer: {
            name: String(formData.get("name") ?? ""),
            phone: String(formData.get("phone") ?? ""),
            email: String(formData.get("email") ?? ""),
          },
          deliveryMethod,
          address,
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Não foi possível criar o pedido.");
      clearCart();
      const preferenceResponse = await fetch("/api/payments/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: payload.orderId }),
      });
      const preferencePayload = await preferenceResponse.json();
      if (!preferenceResponse.ok) {
        router.push(`/pedido/${payload.orderId}?payment=unavailable`);
        return;
      }
      window.location.assign(preferencePayload.checkoutUrl);
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : "Não foi possível criar o pedido.");
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout-layout" onSubmit={handleSubmit}>
      <div className="checkout-forms">
        <div className="checkout-heading"><p className="section-eyebrow">Checkout sem cadastro</p><h1>Finalize seus dados.</h1><p>Não é necessário criar login. Usaremos estes dados apenas para identificar e atender o pedido.</p></div>
        {quoteError || submitError ? <div className="form-alert error" role="alert">{quoteError ?? submitError}</div> : null}
        <fieldset className="form-section">
          <legend><span>01</span> Seus dados</legend>
          <div className="field-grid">
            <label className="field full"><span>Nome completo</span><input autoComplete="name" minLength={2} name="name" required /></label>
            <label className="field"><span>Telefone / WhatsApp</span><input autoComplete="tel" minLength={8} name="phone" required type="tel" /></label>
            <label className="field"><span>E-mail <small>opcional</small></span><input autoComplete="email" name="email" type="email" /></label>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend><span>02</span> Como receber</legend>
          <div className="delivery-options">
            {settings.allowLocalPickup ? <label className={deliveryMethod === "LOCAL_PICKUP" ? "delivery-card selected" : "delivery-card"}><input checked={deliveryMethod === "LOCAL_PICKUP"} name="deliveryMethod" onChange={() => setDeliveryMethod("LOCAL_PICKUP")} type="radio" value="LOCAL_PICKUP" /><StoreIcon name="bag" /><span><strong>Retirada na loja</strong><small>Combine o horário após o pedido.</small></span><b>Grátis</b></label> : null}
            {settings.allowLocalDelivery ? <label className={deliveryMethod === "LOCAL_DELIVERY" ? "delivery-card selected" : "delivery-card"}><input checked={deliveryMethod === "LOCAL_DELIVERY"} name="deliveryMethod" onChange={() => setDeliveryMethod("LOCAL_DELIVERY")} type="radio" value="LOCAL_DELIVERY" /><StoreIcon name="pin" /><span><strong>Entrega local</strong><small>Disponível na região atendida pela loja.</small></span><b>{settings.localDeliveryFeeCents ? formatCurrency(settings.localDeliveryFeeCents) : "Grátis"}</b></label> : null}
          </div>
          {deliveryMethod === "LOCAL_DELIVERY" ? <div className="field-grid address-grid">
            <label className="field"><span>CEP</span><input autoComplete="postal-code" name="zipCode" required /></label>
            <label className="field wide"><span>Rua</span><input autoComplete="address-line1" name="street" required /></label>
            <label className="field"><span>Número</span><input name="number" required /></label>
            <label className="field"><span>Complemento <small>opcional</small></span><input autoComplete="address-line2" name="complement" /></label>
            <label className="field"><span>Bairro</span><input name="neighborhood" required /></label>
            <label className="field"><span>Cidade</span><input autoComplete="address-level2" name="city" required /></label>
            <label className="field short"><span>UF</span><input autoComplete="address-level1" maxLength={2} name="state" required /></label>
          </div> : null}
        </fieldset>
        <fieldset className="form-section">
          <legend><span>03</span> Observações</legend>
          <label className="field full"><span>Algum detalhe para a loja? <small>opcional</small></span><textarea maxLength={500} name="notes" rows={4} /></label>
        </fieldset>
      </div>
      <aside className="checkout-summary">
        <p className="section-eyebrow">Revisão final</p><h2>{quote?.items.length ?? 0} item(ns)</h2>
        <div className="checkout-mini-lines">{quote?.items.map((item) => <div key={`${item.productId}:${item.variantId ?? "simple"}`}><span>{item.quantity}× {item.productName}<small>{item.variantName}</small></span><strong>{formatCurrency(item.totalCents)}</strong></div>)}</div>
        <div className="summary-row"><span>Subtotal</span><strong>{quote ? formatCurrency(quote.subtotalCents) : "—"}</strong></div>
        <div className="summary-row"><span>{deliveryMethod === "LOCAL_DELIVERY" ? "Entrega local" : "Retirada"}</span><strong>{shippingCents ? formatCurrency(shippingCents) : "Grátis"}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{formatCurrency(totalCents)}</strong></div>
        <button className="primary-button full" disabled={submitting || !quote || Boolean(quote.issues.length)} type="submit">{submitting ? "Preparando pagamento…" : "Criar pedido e pagar"} <StoreIcon name="arrow" /></button>
        <p className="summary-note"><StoreIcon name="shield" size={17} /> Você pagará no ambiente seguro do Mercado Pago. O retorno ao site não confirma o pagamento; o pedido só muda após validação do webhook.</p>
      </aside>
    </form>
  );
}
