import { describe, expect, it } from "vitest";
import { PV_MODA_CATEGORIES, PV_MODA_PRODUCTS, validatePvModaSeed } from "../../prisma/seed-data";

describe("seed da PV Moda Masculina", () => {
  it("possui catálogo inicial completo e consistente", () => {
    expect(PV_MODA_CATEGORIES).toHaveLength(6);
    expect(PV_MODA_PRODUCTS).toHaveLength(6);
    expect(PV_MODA_PRODUCTS.every((product) => product.variants.length > 0)).toBe(true);
    expect(PV_MODA_PRODUCTS.every((product) => product.basePriceCents > 0)).toBe(true);
    expect(() => validatePvModaSeed()).not.toThrow();
  });
});
