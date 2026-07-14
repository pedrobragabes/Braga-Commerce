export const BETA_ACCESS_COOKIE = "bc_beta_access";

const tokenPayload = "braga-commerce:beta-access:v1";
const encoder = new TextEncoder();

type BetaAccessEnvironment = Record<string, string | undefined>;

export type BetaAccessConfig = {
  password: string;
  secret: string;
};

export class BetaAccessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetaAccessConfigurationError";
  }
}

export function getBetaAccessConfig(
  environment: BetaAccessEnvironment = process.env,
): BetaAccessConfig | null {
  const password = environment.SITE_ACCESS_PASSWORD;
  const secret = environment.SITE_ACCESS_SECRET;

  if (!password && !secret) return null;
  if (!password || password.length < 12) {
    throw new BetaAccessConfigurationError(
      "SITE_ACCESS_PASSWORD deve possuir pelo menos 12 caracteres.",
    );
  }
  if (!secret || secret.length < 32) {
    throw new BetaAccessConfigurationError(
      "SITE_ACCESS_SECRET deve possuir pelo menos 32 caracteres.",
    );
  }

  return { password, secret };
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function createBetaAccessToken(secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenPayload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function verifyBetaAccessToken(token: string | undefined, secret: string) {
  if (!token || token.length > 128) return false;

  try {
    const key = await importHmacKey(secret);
    return crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(token),
      encoder.encode(tokenPayload),
    );
  } catch {
    return false;
  }
}

export async function verifyBetaPassword(candidate: string, configuredPassword: string) {
  if (!candidate || candidate.length > 256) return false;

  const [candidateHash, configuredHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(configuredPassword)),
  ]);
  const candidateBytes = new Uint8Array(candidateHash);
  const configuredBytes = new Uint8Array(configuredHash);
  let difference = 0;

  for (let index = 0; index < configuredBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ configuredBytes[index];
  }

  return difference === 0;
}
