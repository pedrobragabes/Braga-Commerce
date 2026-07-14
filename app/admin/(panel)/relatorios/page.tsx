import Link from "next/link";
import { requireAdminSession } from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/database";
import {
  calculateAverageTicket,
  resolveSalesPeriod,
  salesPeriodOptions,
} from "../../../../lib/sales-report";
import { formatCurrency } from "../../../../storefront/format";
import { AdminPageHeader, EmptyAdminState } from "../../components/ui";

export default async function AdminSalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireAdminSession("orders:read");
  const { period } = await searchParams;
  const selectedPeriod = resolveSalesPeriod(period);
  const where = {
    storeId: session.storeId,
    paymentStatus: "PAID" as const,
    ...(selectedPeriod.since
      ? { createdAt: { gte: selectedPeriod.since, lte: selectedPeriod.until } }
      : {}),
  };
  const database = getDatabase();
  const [aggregate, paidOrders] = await Promise.all([
    database.order.aggregate({
      where,
      _sum: { totalCents: true, shippingCents: true },
      _count: true,
    }),
    database.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        totalCents: true,
        shippingCents: true,
        deliveryMethod: true,
        createdAt: true,
      },
    }),
  ]);
  const revenueCents = aggregate._sum.totalCents ?? 0;
  const shippingCents = aggregate._sum.shippingCents ?? 0;
  const averageTicketCents = calculateAverageTicket(revenueCents, aggregate._count);

  return (
    <>
      <AdminPageHeader
        index="05"
        eyebrow="Leitura comercial"
        title="Vendas sem adivinhação."
        description="Somente pedidos com pagamento confirmado entram nos números. O filtro e o isolamento da loja são aplicados no servidor."
        action={<Link className="admin-button ghost" href="/admin/pedidos">Ver pedidos →</Link>}
      />
      <nav className="admin-filter-tabs" aria-label="Período do relatório">
        {salesPeriodOptions.map((option) => (
          <Link
            className={selectedPeriod.key === option.key ? "active" : ""}
            href={`/admin/relatorios?period=${option.key}`}
            key={option.key}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      <section className="admin-metrics" aria-label={`Indicadores de ${selectedPeriod.label.toLowerCase()}`}>
        <article className="accent"><small>Receita confirmada</small><strong>{formatCurrency(revenueCents)}</strong><span>Pedidos atualmente marcados como pagos</span></article>
        <article><small>Pedidos pagos</small><strong>{String(aggregate._count).padStart(2, "0")}</strong><span>{selectedPeriod.label}</span></article>
        <article><small>Ticket médio</small><strong>{formatCurrency(averageTicketCents)}</strong><span>Receita dividida pelos pedidos pagos</span></article>
        <article><small>Frete cobrado</small><strong>{formatCurrency(shippingCents)}</strong><span>Incluído no total dos pedidos</span></article>
      </section>
      <div className="admin-alert">
        O período usa a data de criação do pedido. Uma data própria de confirmação do pagamento será necessária antes de transformar este painel em relatório financeiro.
      </div>
      <section className="admin-section">
        <div className="admin-section-heading">
          <div><p className="admin-kicker">Composição do período</p><h2>Pedidos confirmados</h2></div>
          <span>{aggregate._count > 100 ? `100 de ${aggregate._count} pedidos mais recentes` : `${aggregate._count} pedido(s)`}</span>
        </div>
        {paidOrders.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Pedido</th><th>Data</th><th>Entrega</th><th>Frete</th><th>Total</th></tr></thead>
              <tbody>{paidOrders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/admin/pedidos/${order.id}`}><strong>#{order.id.slice(-7).toUpperCase()}</strong><small>Pagamento confirmado</small></Link></td>
                  <td>{order.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</td>
                  <td>{order.deliveryMethod === "LOCAL_PICKUP" ? "Retirada" : order.deliveryMethod === "LOCAL_DELIVERY" ? "Entrega local" : "Transportadora"}</td>
                  <td>{formatCurrency(order.shippingCents)}</td>
                  <td><strong>{formatCurrency(order.totalCents)}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyAdminState title="Nenhuma venda confirmada" description="Altere o período ou aguarde a confirmação de um pagamento." />}
      </section>
    </>
  );
}
