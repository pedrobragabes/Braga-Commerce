import { describe, expect, it } from "vitest";
import { pvModaConfig } from "../../storefront/config/pv-moda";

describe("storefront customizável", () => {
  it("mantém identidade do cliente fora dos componentes", () => {
    expect(pvModaConfig.storeSlug).toBe("pv-moda-masculina");
    expect(pvModaConfig.theme.brand).toMatch(/^#/);
    expect(pvModaConfig.benefits).toHaveLength(3);
  });

});
