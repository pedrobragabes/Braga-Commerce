import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("../../lib/database", () => ({
  getDatabase: () => ({ $queryRaw: queryRaw }),
}));

import { enforceRateLimit, rateLimitPolicies } from "../../lib/rate-limit";

describe("customer auth rate limiting", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("fails closed without exposing the identifier when persistence is unavailable", async () => {
    queryRaw.mockRejectedValue(new Error("database unavailable"));
    const response = await enforceRateLimit(
      new Request("https://example.test/entrar", {
        headers: { "x-forwarded-for": "203.0.113.42" },
      }),
      rateLimitPolicies.customerAuthIp,
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(await response?.json()).toEqual({
      error: {
        code: "PROTECTION_UNAVAILABLE",
        message: "Proteção temporariamente indisponível.",
      },
    });
  });
});
