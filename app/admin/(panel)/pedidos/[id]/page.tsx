import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../lib/admin-auth";
import { allowedFulfillmentTargets } from "../../../../../lib/admin-rules";
import { getDatabase } from "../../../../../lib/database";
import { formatCurrency } from "../../../../../storefront/format";
import { updateOrderOperation } from "../../../actions";
import { AdminPageHeader, AdminStatus, SavedNotice } from "../../../components/ui";

const fulfillmentLabels: Record<string, string> = {
  NOT_FULFILLED: "A separar", PREPARING: "Em preparação", READY_FOR_PICKUP: "Pronto para retirada",
  SHIPPED: "Enviado", DELIVERED: "Entregue", CANCELLED: "Cancelado",
};

export default async function AdminOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const session = await requireAdminSession("orders:read");
  const { id } = await params;
  const { saved } = await searchParams;
  const order = await getDatabase().order.findFirst({
    where: { id, storeId: session.storeId },
    include: { items: { orderBy: { id: "asc" } }, paymentEvents: { orderBy: { createdAt: "desc" }, take: 6 } },
  });
  if (!order) notFound();
  const address = [order.shippingStreet, order.shippingNumber, order.shippingComplement, order.shippingNeighborhood, order.shippingCity, order.shippingState, order.shippingZipCode].filter(Boolean).join(", ");
  const targets = allowedFulfillmentTargets(order.fulfillmentStatus);
  return (
    <>
      <AdminPageHeader index="04.1" eyebrow={`Pedido de ${order.createdAt.toLocaleDateString("pt-BR")}`} title={`#${order.id.slice(-7).toUpperCase()}`} description="Snapshots preservam exatamente o que o cliente comprou." action={<Link className="admin-button ghost" href="/admin/pedidos">← Pedidos</Link>} />
      <SavedNotice show={Boolean(saved)}>Operação do pedido atualizada.</SavedNotice>
      <div className="admin-order-grid">
        <section className="admin-form-card">
          <div className="admin-card-heading"><div><p className="admin-kicker">Itens do pedido</p><h2>{order.customerName}</h2></div><AdminStatus value={order.paymentStatus} /></div>
          {order.inventoryStatus === "REQUIRES_REVIEW" ? <div className="admin-alert">Pagamento confirmado após a reserva expirar. Revise o estoque antes de atender.</div> : null}
          <div className="admin-order-customer"><p><span>Contato</span><strong>{order.customerPhone}</strong><small>{order.customerEmail || "E-mail não informado"}</small></p><p><span>Modalidade</span><strong>{order.deliveryMethod === "LOCAL_PICKUP" ? "Retirada na loja" : "Entrega local"}</strong><small>{address || "Sem endereço de entrega"}</small></p></div>
          <div className="admin-order-lines">{order.items.map((item) => <div key={item.id}><span><strong>{item.quantity}× {item.productName}</strong><small>{item.variantName || item.sku || "Produto simples"}</small></span><span>{formatCurrency(item.totalCents)}</span></div>)}</div>
          <div className="admin-order-totals"><p><span>Subtotal</span><strong>{formatCurrency(order.subtotalCents)}</strong></p><p><span>Entrega</span><strong>{formatCurrency(order.shippingCents)}</strong></p><p className="total"><span>Total</span><strong>{formatCurrency(order.totalCents)}</strong></p></div>
          {order.notes ? <div className="admin-customer-note"><span>Observação do cliente</span><p>{order.notes}</p></div> : null}
        </section>
        <aside className="admin-form-card admin-operation-card">
          <div className="admin-card-heading"><div><p className="admin-kicker">Operação interna</p><h2>Próximo passo</h2></div></div>
          <form action={updateOrderOperation} className="admin-stack-form"><input name="orderId" type="hidden" value={order.id} /><label><span>Status de separação</span><select defaultValue={order.fulfillmentStatus} name="fulfillmentStatus">{targets.map((target) => <option key={target} value={target}>{fulfillmentLabels[target]}</option>)}</select></label><label><span>Nota interna</span><textarea defaultValue={order.internalNote ?? ""} maxLength={500} name="internalNote" placeholder="Não aparece para o cliente" rows={7} /></label><button className="admin-button primary" type="submit">Atualizar operação →</button></form>
          <div className="admin-payment-ledger"><span>Registro de pagamento</span>{order.paymentEvents.length ? order.paymentEvents.map((event) => <p key={event.id}><strong>{event.providerStatus}</strong><small>{event.result} · {event.createdAt.toLocaleString("pt-BR")}</small></p>) : <p><small>Nenhum evento recebido.</small></p>}</div>
          <div className="admin-payment-ledger"><span>Datas comerciais</span><p><small>Reserva: {order.reservedAt?.toLocaleString("pt-BR") ?? "legado"}</small></p><p><small>Pagamento: {order.paidAt?.toLocaleString("pt-BR") ?? "aguardando"}</small></p><p><small>Cancelamento: {order.cancelledAt?.toLocaleString("pt-BR") ?? "—"}</small></p><p><small>Reembolso: {order.refundedAt?.toLocaleString("pt-BR") ?? "—"}</small></p></div>
        </aside>
      </div>
    </>
  );
}
