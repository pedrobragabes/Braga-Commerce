import { NextResponse } from "next/server";
import {
  BETA_ACCESS_COOKIE,
  createBetaAccessToken,
  getBetaAccessConfig,
  verifyBetaPassword,
} from "../../../lib/beta-access";

export async function POST(request: Request) {
  let config: ReturnType<typeof getBetaAccessConfig>;
  try {
    config = getBetaAccessConfig();
  } catch {
    return NextResponse.redirect(new URL("/acesso-beta?erro=config", request.url), 303);
  }

  if (!config) return NextResponse.redirect(new URL("/", request.url), 303);

  const formData = await request.formData();
  const password = formData.get("password");
  const valid = typeof password === "string"
    && await verifyBetaPassword(password, config.password);

  if (!valid) {
    return NextResponse.redirect(new URL("/acesso-beta?erro=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(BETA_ACCESS_COOKIE, await createBetaAccessToken(config.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
