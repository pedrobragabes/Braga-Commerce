import { afterEach, describe, expect, it } from "vitest";
import { can } from "../../lib/admin-auth";
import {
  allowedFulfillmentTargets,
  canTransitionFulfillment,
  parseAdminMoney,
  slugifyAdminValue,
  visibleAdminSections,
} from "../../lib/admin-rules";
import { getSupabasePublicConfig, SupabaseConfigurationError } from "../../lib/supabase/config";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalDatabaseUrl = process.env.DATABASE_SUPABASE_URL;
const originalDatabaseKey = process.env.NEXT_PUBLIC_DATABASE_SUPABASE_PUBLISHABLE_KEY;
const originalDatabaseAnonKey = process.env.DATABASE_SUPABASE_ANON_KEY;

afterEach(() => {
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("NEXT_PUBLIC_SUPABASE_URL", originalUrl);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalKey);
  restore("DATABASE_SUPABASE_URL", originalDatabaseUrl);
  restore("NEXT_PUBLIC_DATABASE_SUPABASE_PUBLISHABLE_KEY", originalDatabaseKey);
  restore("DATABASE_SUPABASE_ANON_KEY", originalDatabaseAnonKey);
});

describe("admin authorization", () => {
  it("keeps settings and catalog writes away from STAFF", () => {
    expect(can("OWNER", "settings:write")).toBe(true);
    expect(can("ADMIN", "catalog:write")).toBe(true);
    expect(can("STAFF", "catalog:write")).toBe(false);
    expect(can("STAFF", "inventory:write")).toBe(true);
    expect(can("STAFF", "orders:write")).toBe(true);
    expect(visibleAdminSections("STAFF").some((item) => item.href === "/admin/configuracoes")).toBe(false);
  });
});

describe("fulfillment transitions", () => {
  it("allows the operational path and blocks reopening terminal states", () => {
    expect(canTransitionFulfillment("NOT_FULFILLED", "PREPARING")).toBe(true);
    expect(canTransitionFulfillment("PREPARING", "READY_FOR_PICKUP")).toBe(true);
    expect(canTransitionFulfillment("READY_FOR_PICKUP", "DELIVERED")).toBe(true);
    expect(canTransitionFulfillment("DELIVERED", "PREPARING")).toBe(false);
    expect(canTransitionFulfillment("CANCELLED", "NOT_FULFILLED")).toBe(false);
    expect(allowedFulfillmentTargets("SHIPPED")).toEqual(["SHIPPED", "DELIVERED", "CANCELLED"]);
  });
});

describe("admin value normalization", () => {
  it("creates stable slugs and integer cents", () => {
    expect(slugifyAdminValue("  Camisa Linho Premium  ")).toBe("camisa-linho-premium");
    expect(parseAdminMoney("149,90")).toBe(14990);
    expect(parseAdminMoney("-1")).toBeNull();
    expect(parseAdminMoney("abc")).toBeNull();
  });
});

describe("Supabase configuration", () => {
  it("supports standard and Vercel integration variable names", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.DATABASE_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_DATABASE_SUPABASE_PUBLISHABLE_KEY = "publishable-test";
    expect(getSupabasePublicConfig()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "publishable-test",
    });
  });

  it("fails clearly when auth configuration is absent", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.DATABASE_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_DATABASE_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.DATABASE_SUPABASE_ANON_KEY;
    expect(() => getSupabasePublicConfig()).toThrow(SupabaseConfigurationError);
  });
});
