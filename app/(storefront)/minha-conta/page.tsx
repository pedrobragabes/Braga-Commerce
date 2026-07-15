import type { Metadata } from "next";
import Link from "next/link";
import { getDatabase } from "../../../lib/database";
import { requireCustomerSession } from "../../../lib/customer-auth";
import { buildCustomerOrderScope } from "../../../lib/customer-orders";
import { formatCurrency } from "../../../storefront/format";
import { pvModaConfig } from "../../../storefront/config/pv-moda";
import { logoutCustomer } from "../auth-actions";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false, follow: false } };

const paymentLabels: Record<string, string> = {
  WAITING_PAYMENT: "Aguardando pagamento", PAID: "Pago", FAILED: "Pagamento recusado",
  CANCELLED: "Cancelado", REFUNDED: "Reembolsado",
};
const orderLabels: Record<string, string> = {
  PENDING: "Pedido recebido", CONFIRMED: "Confirmado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado",
};

export default async function CustomerAccountPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [session, query] = await Promise.all([requireCustomerSession(), searchParams]);
  const database = getDatabase();
  const store = await database.store.findUnique({ where: { slug: pvModaConfig.storeSlug }, select: { id: true } });
  const orders = store ? await database.order.findMany({
    where: buildCustomerOrderScope(store.id, session.email),
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true, status: true, paymentStatus: true, fulfillmentStatus: true,
      totalCents: true, createdAt: true, deliveryMethod: true, _count: { select: { items: true } },
    },
  }) : [];

  return (
    <section className="customer-account-page">
      <div className="store-container">
        {query.status === "senha-alterada" ? <div className="form-alert success" role="status">Sua senha foi alterada.</div> : null}
        <header className="customer-account-header">
          <div><p className="section-eyebrow">Minha conta</p><h1>Olá, {session.name}.</h1><p>{session.email}</p></div>
          <form action={logoutCustomer}><button className="secondary-button" type="submit">Sair da conta</button></form>
        </header>
        <div className="customer-account-grid">
          <aside className="customer-profile-card">
            <span className="customer-avatar">{session.name.slice(0, 1).toUpperCase()}</span>
            <div><small>Conta verificada</small><strong>{session.name}</strong><span>{session.email}</span></div>
            <Link href="/redefinir-senha">Alterar minha senha →</Link>
            <p>Pedidos feitos como convidado aparecem aqui quando usam este mesmo e-mail verificado.</p>
          </aside>
          <div className="customer-orders-panel">
            <div className="customer-orders-heading"><div><p className="section-eyebrow">Histórico</p><h2>Meus pedidos</h2></div><span>{orders.length} pedido(s)</span></div>
            {orders.length ? <div className="customer-order-list">{orders.map((order) => (
              <article className="customer-order-card" key={order.id}>
                <div><small>{order.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</small><strong>#{order.id.slice(-7).toUpperCase()}</strong><span>{order._count.items} item(ns) · {order.deliveryMethod === "LOCAL_PICKUP" ? "Retirada" : "Entrega"}</span></div>
                <div className="customer-order-status"><span>{orderLabels[order.status] ?? order.status}</span><small>{paymentLabels[order.paymentStatus] ?? order.paymentStatus}</small></div>
                <div className="customer-order-total"><strong>{formatCurrency(order.totalCents)}</strong><Link href={`/pedido/${order.id}`}>Ver pedido →</Link></div>
              </article>
            ))}</div> : <div className="customer-orders-empty"><span>PV</span><h3>Seu primeiro pedido ainda está por vir.</h3><p>Quando você comprar usando {session.email}, o pedido aparecerá aqui.</p><Link className="primary-button" href="/produtos">Explorar produtos</Link></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
