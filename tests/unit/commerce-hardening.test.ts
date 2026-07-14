import { describe, expect, it } from "vitest";
import { renderOrderEmail } from "../../lib/email/templates";
import { getOrderExpiration } from "../../lib/inventory";
import { createRateLimitKey, getClientAddress } from "../../lib/rate-limit";
import { buildPaidPeriodFilter } from "../../lib/sales-report";

describe("hardening comercial", () => {
  it("expira a reserva trinta minutos depois da criação", () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    expect(getOrderExpiration(now).toISOString()).toBe("2026-07-14T18:30:00.000Z");
  });

  it("não persiste o endereço de rede na chave do rate limit", () => {
    const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(getClientAddress(request)).toBe("203.0.113.7");
    const key = createRateLimitKey("order", getClientAddress(request), "test-secret");
    expect(key).toHaveLength(64);
    expect(key).not.toContain("203.0.113.7");
  });

  it("filtra vendas novas por paidAt e mantém fallback legado", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    const until = new Date("2026-08-01T00:00:00.000Z");
    expect(buildPaidPeriodFilter(since, until)).toEqual({
      OR: [
        { paidAt: { gte: since, lte: until } },
        { paidAt: null, createdAt: { gte: since, lte: until } },
      ],
    });
  });

  it("escapa conteúdo do cliente nos templates transacionais", () => {
    const email = renderOrderEmail("ORDER_CREATED", {
      id: "order-1234567",
      customerName: "<script>alert(1)</script>",
      totalCents: 12990,
      deliveryMethod: "LOCAL_PICKUP",
    }, "PV Moda", "https://example.test/pedido/order-1234567");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.subject).toContain("#1234567");
  });
});
