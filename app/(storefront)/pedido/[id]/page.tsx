import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreIcon } from "../../../../storefront/components/icons";
import { PaymentStatusNotice } from "../../../../storefront/checkout/payment-status-notice";
import { pvModaConfig } from "../../../../storefront/config/pv-moda";
import { getPublicOrder, getStoreNavigation } from "../../../../storefront/data";
import { formatCurrency, normalizeWhatsapp } from "../../../../storefront/format";

export const metadata: Metadata = { title: "Pedido recebido", robots: { index: false, follow: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  const { payment } = await searchParams;
  const [order, navigation] = await Promise.all([
    getPublicOrder(pvModaConfig.storeSlug, id),
    getStoreNavigation(pvModaConfig.storeSlug),
  ]);
  if (!order || !navigation) notFound();

  const phone = normalizeWhatsapp(navigation.store.whatsapp);
  const message = `Olá! Gostaria de acompanhar o pedido ${order.id}.`;

  return (
    <section className="order-success-page">
      <div className="store-container order-success-grid">
        <div className="order-success-copy">
          <span className="success-mark"><StoreIcon name="check" size={38} /></span>
          <p className="section-eyebrow">Pedido recebido</p>
          <h1>Agora é com a PV Moda.</h1>
          <p>Seu pedido está salvo. A confirmação do pagamento e o andamento da retirada ou entrega aparecerão aqui.</p>
          <div className="order-code"><small>Código do pedido</small><strong>{order.id}</strong></div>
          <PaymentStatusNotice
            initialStatus={order.paymentStatus}
            orderId={order.id}
            returnHint={payment === "success" || payment === "pending" || payment === "failure" || payment === "unavailable" ? payment : null}
          />
          <div className="success-actions">
            {phone ? <a className="primary-button" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} rel="noreferrer" target="_blank"><StoreIcon name="whatsapp" /> Falar sobre o pedido</a> : null}
            <Link className="secondary-button" href="/produtos">Voltar à loja</Link>
          </div>
        </div>
        <aside className="order-receipt">
          <p className="section-eyebrow">Resumo salvo</p>
          <h2>{order.items.length} item(ns)</h2>
          <div className="receipt-lines">{order.items.map((item) => <div key={item.id}><span>{item.quantity}× {item.productName}<small>{item.variantName}</small></span><strong>{formatCurrency(item.totalCents)}</strong></div>)}</div>
          <div className="summary-row"><span>Subtotal</span><strong>{formatCurrency(order.subtotalCents)}</strong></div>
          <div className="summary-row"><span>{order.deliveryMethod === "LOCAL_PICKUP" ? "Retirada" : "Entrega"}</span><strong>{order.shippingCents ? formatCurrency(order.shippingCents) : "Grátis"}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{formatCurrency(order.totalCents)}</strong></div>
          <p className="receipt-status"><span /> {order.paymentStatus === "PAID" ? "Pagamento confirmado" : "Pedido salvo"}</p>
        </aside>
      </div>
    </section>
  );
}
