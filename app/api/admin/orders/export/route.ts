import { NextResponse } from "next/server";
import { can, getAdminSession } from "../../../../../lib/admin-auth";
import { buildCsv, formatCentsForCsv } from "../../../../../lib/csv";
import { getDatabase } from "../../../../../lib/database";
import { resolveSalesPeriod } from "../../../../../lib/sales-report";

const exportLimit = 5000;

const deliveryLabels = {
  LOCAL_PICKUP: "Retirada",
  LOCAL_DELIVERY: "Entrega local",
  SHIPPING: "Transportadora",
} as const;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return errorResponse(401, "AUTH_REQUIRED", "Entre no painel para exportar pedidos.");
  if (!can(session.role, "orders:read")) {
    return errorResponse(403, "FORBIDDEN", "Seu perfil não pode exportar pedidos.");
  }

  const url = new URL(request.url);
  const selectedPeriod = resolveSalesPeriod(url.searchParams.get("period") ?? undefined);
  const orders = await getDatabase().order.findMany({
    where: {
      storeId: session.storeId,
      paymentStatus: "PAID",
      ...(selectedPeriod.since
        ? { createdAt: { gte: selectedPeriod.since, lte: selectedPeriod.until } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: exportLimit + 1,
    select: {
      id: true,
      createdAt: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      deliveryMethod: true,
      subtotalCents: true,
      shippingCents: true,
      discountCents: true,
      totalCents: true,
      items: { select: { quantity: true } },
    },
  });

  if (orders.length > exportLimit) {
    return errorResponse(
      413,
      "EXPORT_LIMIT_EXCEEDED",
      "Refine o período para exportar no máximo 5.000 pedidos por arquivo.",
    );
  }

  const csv = buildCsv([
    [
      "pedido",
      "criado_em_utc",
      "pagamento",
      "operacao",
      "entrega",
      "quantidade_itens",
      "subtotal_brl",
      "frete_brl",
      "desconto_brl",
      "total_brl",
    ],
    ...orders.map((order) => [
      order.id,
      order.createdAt.toISOString(),
      order.paymentStatus,
      order.fulfillmentStatus,
      deliveryLabels[order.deliveryMethod],
      order.items.reduce((total, item) => total + item.quantity, 0),
      formatCentsForCsv(order.subtotalCents),
      formatCentsForCsv(order.shippingCents),
      formatCentsForCsv(order.discountCents),
      formatCentsForCsv(order.totalCents),
    ]),
  ]);
  const filename = `vendas-${selectedPeriod.key}-${selectedPeriod.until.toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
