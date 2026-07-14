import { describe, expect, it } from "vitest";
import {
  BetaAccessConfigurationError,
  createBetaAccessToken,
  getBetaAccessConfig,
  verifyBetaAccessToken,
  verifyBetaPassword,
} from "../../lib/beta-access";

describe("beta access", () => {
  const secret = "a-secure-beta-secret-with-more-than-32-characters";

  it("is disabled only when both server variables are absent", () => {
    expect(getBetaAccessConfig({})).toBeNull();
    expect(() => getBetaAccessConfig({ SITE_ACCESS_PASSWORD: "short" }))
      .toThrow(BetaAccessConfigurationError);
    expect(() => getBetaAccessConfig({
      SITE_ACCESS_PASSWORD: "valid-password",
      SITE_ACCESS_SECRET: "short",
    })).toThrow(BetaAccessConfigurationError);
  });

  it("checks the password without returning or logging it", async () => {
    await expect(verifyBetaPassword("correct-password", "correct-password")).resolves.toBe(true);
    await expect(verifyBetaPassword("incorrect", "correct-password")).resolves.toBe(false);
  });

  it("signs and verifies a tamper-resistant access token", async () => {
    const token = await createBetaAccessToken(secret);
    await expect(verifyBetaAccessToken(token, secret)).resolves.toBe(true);
    await expect(verifyBetaAccessToken(`${token}x`, secret)).resolves.toBe(false);
    expect(token).not.toContain(secret);
  });
});
