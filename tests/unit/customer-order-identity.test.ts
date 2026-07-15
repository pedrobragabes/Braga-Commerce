import { describe, expect, it } from "vitest";
import {
  CustomerIdentityError,
  resolveCheckoutEmail,
  selectCheckoutCustomer,
} from "../../lib/orders";

const identity = { authUserId: "auth-a", email: "a@example.com" };

describe("customer checkout identity", () => {
  it("reuses the customer linked to the authenticated identity", () => {
    const linked = { id: "customer-a", authUserId: "auth-a" };
    expect(selectCheckoutCustomer(identity, linked, linked)).toBe(linked);
  });

  it("rejects a phone owned by another authenticated identity", () => {
    expect(() =>
      selectCheckoutCustomer(identity, null, { id: "customer-b", authUserId: "auth-b" }),
    ).toThrow(CustomerIdentityError);
  });

  it("rejects changing a linked account to another customer phone", () => {
    expect(() =>
      selectCheckoutCustomer(
        identity,
        { id: "customer-a", authUserId: "auth-a" },
        { id: "customer-b", authUserId: null },
      ),
    ).toThrow("Este telefone já está associado a outro cadastro.");
  });

  it("keeps guest checkout compatible with an existing phone", () => {
    const customer = { id: "customer-a", authUserId: "auth-a" };
    expect(selectCheckoutCustomer(null, null, customer)).toBe(customer);
  });

  it("ignores the submitted e-mail for an authenticated checkout", () => {
    expect(resolveCheckoutEmail("attacker@example.test", identity)).toBe("a@example.com");
    expect(resolveCheckoutEmail("guest@example.test", null)).toBe("guest@example.test");
    expect(resolveCheckoutEmail("", null)).toBeNull();
  });
});
