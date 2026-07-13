import Link from "next/link";
import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import { formatCurrency } from "../../../../storefront/format";
import { AdminPageHeader, AdminStatus, EmptyAdminState } from "../../components/ui";

const filters = [
  ["", "Todos"], ["WAITING_PAYMENT", "Aguardando pagamento"], ["PAID", "Pagos"],
  ["NOT_FULFILLED", "A separar"], ["PREPARING", "Preparando"], ["DELIVERED", "Entregues"],
] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requireAdminSession("orders:read");
  const { status } = await searchParams;
  const validPayment = ["WAITING_PAYMENT", "PAID"].includes(status ?? "") ? status : undefined;
  const validFulfillment = ["NOT_FULFILLED", "PREPARING", "DELIVERED"].includes(status ?? "") ? status : undefined;
  const orders = await getDatabase().order.findMany({
    where: {
      storeId: session.storeId,
      ...(validPayment ? { paymentStatus: validPayment as "WAITING_PAYMENT" | "PAID" } : {}),
      ...(validFulfillment ? { fulfillmentStatus: validFulfillment as "NOT_FULFILLED" | "PREPARING" | "DELIVERED" } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, customerName: true, customerPhone: true, totalCents: true, paymentStatus: true, fulfillmentStatus: true, deliveryMethod: true, createdAt: true, _count: { select: { items: true } } },
  });
  return (
    <>
      <AdminPageHeader index="04" eyebrow="Balcão de pedidos" title="Cada venda, um próximo passo." description="Pagamento e operação aparecem separados para evitar decisões erradas." />
      <nav className="admin-filter-tabs" aria-label="Filtrar pedidos">{filters.map(([value, label]) => <Link className={(status ?? "") === value ? "active" : ""} href={value ? `/admin/pedidos?status=${value}` : "/admin/pedidos"} key={value}>{label}</Link>)}</nav>
      {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Pagamento</th><th>Operação</th><th>Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/pedidos/${order.id}`}><strong>#{order.id.slice(-7).toUpperCase()}</strong><small>{order.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small></Link></td><td><strong>{order.customerName}</strong><small>{order.customerPhone} · {order._count.items} item(ns)</small></td><td>{order.deliveryMethod === "LOCAL_PICKUP" ? "Retirada" : "Entrega local"}</td><td><AdminStatus value={order.paymentStatus} /></td><td><AdminStatus value={order.fulfillmentStatus} /></td><td>{formatCurrency(order.totalCents)}</td></tr>)}</tbody></table></div> : <EmptyAdminState title="Nenhum pedido nesta fila" description="Altere o filtro ou aguarde uma nova venda." />}
    </>
  );
}
