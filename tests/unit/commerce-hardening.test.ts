import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmailDriverReady, sendEmail } from "../../lib/email/driver";
import { renderOrderEmail } from "../../lib/email/templates";
import { EMAIL_PROCESSING_LEASE_MS, getEmailProcessingLeaseCutoff } from "../../lib/email/outbox";
import { getOrderExpiration } from "../../lib/inventory";
import { createRateLimitKey, getClientAddress } from "../../lib/rate-limit";
import { buildPaidPeriodFilter } from "../../lib/sales-report";

const originalEmailDriver = process.env.EMAIL_DRIVER;
const originalEmailFrom = process.env.EMAIL_FROM;
const originalResendApiKey = process.env.RESEND_API_KEY;
const originalSmtpHost = process.env.SMTP_HOST;
const originalSmtpPort = process.env.SMTP_PORT;
const originalSmtpUser = process.env.SMTP_USER;
const originalSmtpPass = process.env.SMTP_PASS;

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("EMAIL_DRIVER", originalEmailDriver);
  restore("EMAIL_FROM", originalEmailFrom);
  restore("RESEND_API_KEY", originalResendApiKey);
  restore("SMTP_HOST", originalSmtpHost);
  restore("SMTP_PORT", originalSmtpPort);
  restore("SMTP_USER", originalSmtpUser);
  restore("SMTP_PASS", originalSmtpPass);
  vi.unstubAllGlobals();
});

describe("hardening comercial", () => {
  it("expira a reserva trinta minutos depois da criação", () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    expect(getOrderExpiration(now).toISOString()).toBe("2026-07-14T18:30:00.000Z");
  });

  it("não persiste o endereço de rede na chave do rate limit", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
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
    const email = renderOrderEmail(
      "ORDER_CREATED",
      {
        id: "order-1234567",
        customerName: "<script>alert(1)</script>",
        totalCents: 12990,
        deliveryMethod: "LOCAL_PICKUP",
      },
      "PV Moda",
      "https://example.test/pedido/order-1234567",
    );
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.subject).toContain("#1234567");
  });

  it("recupera somente e-mails cujo processamento perdeu a concessão", () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    expect(getEmailProcessingLeaseCutoff(now)).toEqual(
      new Date(now.getTime() - EMAIL_PROCESSING_LEASE_MS),
    );
  });

  it("usa a chave do evento para tornar o envio no Resend idempotente", async () => {
    process.env.EMAIL_DRIVER = "resend";
    process.env.EMAIL_FROM = "PV Moda <pedidos@example.test>";
    process.env.RESEND_API_KEY = "test-api-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail({
      to: "cliente@example.test",
      subject: "Pedido",
      text: "Pedido recebido",
      html: "<p>Pedido recebido</p>",
      eventId: "outbox-event-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "outbox-event-1" }),
      }),
    );
  });

  it("só habilita SMTP quando a autenticação está completa", () => {
    process.env.EMAIL_DRIVER = "smtp";
    process.env.EMAIL_FROM = "PV Moda <pedidos@example.test>";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "pedidos@example.test";
    delete process.env.SMTP_PASS;
    expect(isEmailDriverReady()).toBe(false);
    process.env.SMTP_PASS = "app-password-for-test";
    expect(isEmailDriverReady()).toBe(true);
  });
});
