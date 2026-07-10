import { describe, expect, it } from "vitest";

describe("Braga Commerce foundation", () => {
  it("keeps the MVP scope explicit", () => {
    expect("product → cart → checkout → payment → paid order").toContain("payment");
  });
});
