import { NextResponse } from "next/server";
import { getPublicAppUrl } from "../../../lib/app-url";
import { safeAccountRedirect } from "../../../lib/customer-auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicAppUrl();
  const code = url.searchParams.get("code");
  const next = safeAccountRedirect(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/entrar?erro=callback", publicOrigin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/entrar?erro=callback", publicOrigin));
  return NextResponse.redirect(new URL(next, publicOrigin));
}
