const productionFallback = "https://braga-commerce.vercel.app";

type AppEnvironment = Record<string, string | undefined>;

export function getPublicAppUrl(environment: AppEnvironment = process.env) {
  const explicitUrl = environment.NEXT_PUBLIC_APP_URL;
  const vercelUrl = environment.VERCEL_ENV === "production"
    ? environment.VERCEL_PROJECT_PRODUCTION_URL ?? environment.VERCEL_URL
    : environment.VERCEL_URL ?? environment.VERCEL_PROJECT_PRODUCTION_URL;
  const rawUrl = explicitUrl
    ?? (vercelUrl ? `https://${vercelUrl}` : undefined)
    ?? (environment.NODE_ENV === "production" ? productionFallback : "http://localhost:3000");

  return new URL(rawUrl).origin;
}

export function getMetadataBase(environment: AppEnvironment = process.env) {
  return new URL(getPublicAppUrl(environment));
}
