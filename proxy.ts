import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  BETA_ACCESS_COOKIE,
  getBetaAccessConfig,
  verifyBetaAccessToken,
} from "./lib/beta-access";
import { getSupabasePublicConfig } from "./lib/supabase/config";

const betaPublicPaths = [
  "/robots.txt",
  "/api/health",
  "/api/webhooks/mercadopago",
  "/api/beta-access",
  "/api/jobs",
  "/auth/callback",
  "/api/integrations/bes/v1",
];

function isBetaPublicPath(pathname: string) {
  // Only this service-key-protected v2 endpoint bypasses the human beta gate.
  return /^\/api\/integrations\/bes\/v2\/stores\/[A-Za-z0-9][A-Za-z0-9_-]{0,79}\/catalog$/.test(pathname)
    || betaPublicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

async function enforceBetaAccess(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAccessPage = pathname === "/acesso-beta";
  let betaConfig: ReturnType<typeof getBetaAccessConfig>;

  try {
    betaConfig = getBetaAccessConfig();
  } catch {
    if (isAccessPage || isBetaPublicPath(pathname)) return null;
    const accessUrl = request.nextUrl.clone();
    accessUrl.pathname = "/acesso-beta";
    accessUrl.search = "?erro=config";
    return NextResponse.redirect(accessUrl);
  }

  if (!betaConfig || isBetaPublicPath(pathname)) return null;

  const validToken = await verifyBetaAccessToken(
    request.cookies.get(BETA_ACCESS_COOKIE)?.value,
    betaConfig.secret,
  );
  if (validToken && isAccessPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }
  if (validToken || isAccessPage) return null;

  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/acesso-beta";
  accessUrl.search = "";
  return NextResponse.redirect(accessUrl);
}

export async function proxy(request: NextRequest) {
  const betaResponse = await enforceBetaAccess(request);
  if (betaResponse) return betaResponse;

  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isCustomerRoute = ["/minha-conta", "/checkout", "/api/orders", "/redefinir-senha", "/entrar", "/cadastro", "/solicitar-loja", "/platform"].includes(pathname);
  if (!isAdmin && !isCustomerRoute) return response;
  response.headers.set("Cache-Control", "private, no-store");

  let config: ReturnType<typeof getSupabasePublicConfig>;
  try {
    config = getSupabasePublicConfig();
  } catch {
    return response;
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (isAdmin && !data.user && !isLogin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    const loginResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => loginResponse.cookies.set(cookie));
    return loginResponse;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
