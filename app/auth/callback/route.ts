import { NextResponse } from "next/server";
import { getStoreRequestOrigin } from "../../../lib/store-context";
import { safeAccountRedirect } from "../../../lib/customer-auth";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let publicOrigin: string;
  try { publicOrigin = await getStoreRequestOrigin(request); }
  catch { return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
  const code = url.searchParams.get("code");
  const next = safeAccountRedirect(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/entrar?erro=callback", publicOrigin));
  let verified = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } catch { /* Provider errors never expose callback codes or credentials. */ }
  const response = NextResponse.redirect(new URL(verified ? next : "/entrar?erro=callback", publicOrigin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
