import { describe, expect, it } from "vitest";
import { getPublicAppUrl } from "../../lib/app-url";
import { sanitizeLogContext } from "../../lib/observability/logger";

describe("production operations", () => {
  it("chooses an explicit, Vercel, production or local public URL", () => {
    expect(getPublicAppUrl({ NEXT_PUBLIC_APP_URL: "https://loja.example/path" })).toBe("https://loja.example");
    expect(getPublicAppUrl({ VERCEL_URL: "preview.vercel.app" })).toBe("https://preview.vercel.app");
    expect(getPublicAppUrl({ NODE_ENV: "production" })).toBe("https://braga-commerce.vercel.app");
    expect(getPublicAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });

  it("keeps PII, secrets and raw errors out of structured logs", () => {
    expect(sanitizeLogContext({
      requestId: "req-1",
      orderId: "order-1",
      email: "cliente@example.com",
      phone: "5511999999999",
      token: "secret",
      message: "raw database error",
    })).toEqual({ requestId: "req-1", orderId: "order-1" });
  });
});
