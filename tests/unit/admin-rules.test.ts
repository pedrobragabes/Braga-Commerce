import { afterEach, describe, expect, it } from "vitest";
import { can } from "../../lib/admin-auth";
import {
  allowedFulfillmentTargets,
  canTransitionFulfillment,
  parseAdminColor,
  parseAdminInteger,
  parseAdminMoney,
  parseAdminState,
  slugifyAdminValue,
  visibleAdminSections,
} from "../../lib/admin-rules";
import { getSupabasePublicConfig, SupabaseConfigurationError } from "../../lib/supabase/config";
import { calculateAverageTicket, resolveSalesPeriod } from "../../lib/sales-report";
import { buildCsv, escapeCsvCell, formatCentsForCsv } from "../../lib/csv";

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
    expect(visibleAdminSections("STAFF").some((item) => item.href === "/admin/relatorios")).toBe(
      true,
    );
    expect(visibleAdminSections("STAFF").some((item) => item.href === "/admin/configuracoes")).toBe(
      false,
    );
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
    expect(parseAdminMoney("")).toBeNull();
    expect(parseAdminMoney("1.234")).toBeNull();
    expect(parseAdminMoney("21474836.48")).toBeNull();
    expect(parseAdminInteger("12")).toBe(12);
    expect(parseAdminInteger("1.5")).toBeNull();
    expect(parseAdminInteger("1item")).toBeNull();
    expect(parseAdminInteger("-1")).toBeNull();
    expect(parseAdminInteger("2147483648")).toBeNull();
    expect(parseAdminColor("#D66A2F")).toBe("#d66a2f");
    expect(parseAdminColor("red")).toBeNull();
    expect(parseAdminState("sp")).toBe("SP");
    expect(parseAdminState("São Paulo")).toBeNull();
  });
});

describe("sales report rules", () => {
  it("uses a safe default and calculates rolling periods on the server", () => {
    const now = new Date("2026-07-14T18:00:00.000Z");
    const defaultPeriod = resolveSalesPeriod(undefined, now);
    expect(defaultPeriod.key).toBe("30d");
    expect(defaultPeriod.since?.toISOString()).toBe("2026-06-14T18:00:00.000Z");
    expect(defaultPeriod.until).not.toBe(now);
    expect(resolveSalesPeriod("invalid", now).key).toBe("30d");
    expect(resolveSalesPeriod("all", now).since).toBeNull();
  });

  it("returns an integer average and handles an empty period", () => {
    expect(calculateAverageTicket(29981, 2)).toBe(14991);
    expect(calculateAverageTicket(0, 0)).toBe(0);
  });
});

describe("CSV export rules", () => {
  it("escapes quotes, line breaks and spreadsheet formulas", () => {
    expect(escapeCsvCell('Camisa "Linho"\nPremium')).toBe('"Camisa ""Linho"" Premium"');
    expect(escapeCsvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
    expect(escapeCsvCell("-10+20")).toBe('"\'-10+20"');
    expect(escapeCsvCell("\t=SUM(1,1)")).toBe('"\'\t=SUM(1,1)"');
  });

  it("builds an Excel-friendly UTF-8 CSV with exact cents", () => {
    expect(formatCentsForCsv(11580)).toBe("115.80");
    expect(
      buildCsv([
        ["pedido", "total"],
        ["abc", formatCentsForCsv(11580)],
      ]),
    ).toBe('\uFEFF"pedido","total"\r\n"abc","115.80"\r\n');
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
