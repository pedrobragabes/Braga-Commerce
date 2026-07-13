import Link from "next/link";
import { requireAdminSession } from "../../../lib/admin-auth";
import { getDatabase } from "../../../lib/database";
import { formatCurrency } from "../../../storefront/format";
import { AdminPageHeader, AdminStatus, EmptyAdminState } from "../components/ui";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ forbidden?: string }>;
}) {
  const session = await requireAdminSession("dashboard:read");
  const { forbidden } = await searchParams;
  const database = getDatabase();
  const [productCount, variantLowStockCount, simpleLowStockCount, pendingOrders, paidAggregate, recentOrders] = await Promise.all([
    database.product.count({ where: { storeId: session.storeId } }),
    database.productVariant.count({ where: { product: { storeId: session.storeId, hasVariants: true }, isActive: true, stockQuantity: { lte: 3 } } }),
    database.product.count({ where: { storeId: session.storeId, hasVariants: false, isActive: true, stockQuantity: { lte: 3 } } }),
    database.order.count({ where: { storeId: session.storeId, fulfillmentStatus: { in: ["NOT_FULFILLED", "PREPARING"] } } }),
    database.order.aggregate({ where: { storeId: session.storeId, paymentStatus: "PAID" }, _sum: { totalCents: true }, _count: true }),
    database.order.findMany({
      where: { storeId: session.storeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, customerName: true, totalCents: true, paymentStatus: true, fulfillmentStatus: true, createdAt: true },
    }),
  ]);
  const lowStockCount = variantLowStockCount + simpleLowStockCount;

  return (
    <>
      <AdminPageHeader index="01" eyebrow="Pulso da loja" title="Bom trabalho começa com clareza." description="O que pede atenção hoje, sem relatório decorativo." />
      {forbidden ? <div className="admin-alert error">Seu perfil não tem permissão para essa área.</div> : null}
      <section className="admin-metrics" aria-label="Indicadores">
        <article className="accent"><small>Receita confirmada</small><strong>{formatCurrency(paidAggregate._sum.totalCents ?? 0)}</strong><span>{paidAggregate._count} pedido(s) pago(s)</span></article>
        <article><small>Pedidos em operação</small><strong>{String(pendingOrders).padStart(2, "0")}</strong><span>A separar ou preparar</span></article>
        <article><small>Catálogo</small><strong>{String(productCount).padStart(2, "0")}</strong><span>Produtos cadastrados</span></article>
        <article className={lowStockCount ? "warning" : ""}><small>Estoque baixo</small><strong>{String(lowStockCount).padStart(2, "0")}</strong><span>Variações com até 3 peças</span></article>
      </section>
      <section className="admin-section">
        <div className="admin-section-heading"><div><p className="admin-kicker">Fila recente</p><h2>Últimos pedidos</h2></div><Link href="/admin/pedidos">Ver todos →</Link></div>
        {recentOrders.length ? (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Pagamento</th><th>Operação</th><th>Total</th></tr></thead><tbody>{recentOrders.map((order) => (
            <tr key={order.id}><td><Link href={`/admin/pedidos/${order.id}`}><strong>#{order.id.slice(-7).toUpperCase()}</strong><small>{order.createdAt.toLocaleDateString("pt-BR")}</small></Link></td><td>{order.customerName}</td><td><AdminStatus value={order.paymentStatus} /></td><td><AdminStatus value={order.fulfillmentStatus} /></td><td>{formatCurrency(order.totalCents)}</td></tr>
          ))}</tbody></table></div>
        ) : <EmptyAdminState title="A fila está limpa" description="Os novos pedidos aparecerão aqui assim que forem criados." />}
      </section>
    </>
  );
}
