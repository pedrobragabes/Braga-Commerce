import { describe, expect, it } from "vitest";
import { customerSessionFromUser, safeAccountRedirect } from "../../lib/customer-auth";
import { buildCustomerOrderScope } from "../../lib/customer-orders";

describe("customer account authorization", () => {
  it("accepts only same-origin relative return paths", () => {
    expect(safeAccountRedirect("/minha-conta?tab=pedidos")).toBe("/minha-conta?tab=pedidos");
    expect(safeAccountRedirect("//evil.example/path")).toBe("/minha-conta");
    expect(safeAccountRedirect("https://evil.example/path")).toBe("/minha-conta");
    expect(safeAccountRedirect(null)).toBe("/minha-conta");
  });

  it("normalizes the Supabase identity used by server queries", () => {
    const session = customerSessionFromUser({
      id: "auth-1",
      email: " Cliente@Example.COM ",
      email_confirmed_at: "2026-07-15T10:00:00.000Z",
      user_metadata: { full_name: "  Pedro Braga  " },
    } as never);
    expect(session).toEqual({ authUserId: "auth-1", email: "cliente@example.com", name: "Pedro Braga" });
  });

  it("does not create an account session without an authenticated e-mail", () => {
    expect(customerSessionFromUser(null)).toBeNull();
    expect(customerSessionFromUser({ id: "auth-2", user_metadata: {} } as never)).toBeNull();
    expect(customerSessionFromUser({ id: "auth-3", email: "pending@example.com", user_metadata: {} } as never)).toBeNull();
  });

  it("builds a store and verified-email scoped order query", () => {
    expect(buildCustomerOrderScope("store-a", " Customer@Example.COM ")).toEqual({
      storeId: "store-a",
      customerEmail: { equals: "customer@example.com", mode: "insensitive" },
    });
  });
});
