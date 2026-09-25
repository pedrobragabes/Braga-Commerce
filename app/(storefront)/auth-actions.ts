"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStoreRequestOrigin } from "../../lib/store-context";
import { customerSessionFromUser, isGoogleLoginEnabled, safeAccountRedirect } from "../../lib/customer-auth";
import { checkRateLimitIdentifier, getClientAddressFromHeaders, rateLimitPolicies } from "../../lib/rate-limit";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8).max(200);

async function allowAuthAttempt(email: string) {
  const requestHeaders = await headers();
  const address = getClientAddressFromHeaders(requestHeaders);
  const [ip, account] = await Promise.all([
    checkRateLimitIdentifier(address, rateLimitPolicies.customerAuthIp),
    checkRateLimitIdentifier(email, rateLimitPolicies.customerAuthAccount),
  ]);
  return ip.allowed && account.allowed;
}

export async function loginCustomer(formData: FormData) {
  const input = z.object({ email: emailSchema, password: passwordSchema }).safeParse({
    email: formData.get("email"), password: formData.get("password"),
  });
  const next = safeAccountRedirect(String(formData.get("next") ?? ""));
  if (!input.success) redirect(`/entrar?erro=dados&next=${encodeURIComponent(next)}`);
  let allowed = false;
  try {
    allowed = await allowAuthAttempt(input.data.email);
  } catch {
    redirect(`/entrar?erro=protecao&next=${encodeURIComponent(next)}`);
  }
  if (!allowed) redirect(`/entrar?erro=limite&next=${encodeURIComponent(next)}`);
  let signedIn = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { error, data } = await supabase.auth.signInWithPassword(input.data);
    signedIn = !error && Boolean(customerSessionFromUser(data.user));
  } catch { /* Provider failures use the same public error. */ }
  if (!signedIn) redirect(`/entrar?erro=credenciais&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function registerCustomer(formData: FormData) {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    confirmation: passwordSchema,
  }).safeParse({
    name: formData.get("name"), email: formData.get("email"),
    password: formData.get("password"), confirmation: formData.get("confirmation"),
  });
  if (!input.success || input.data.password !== input.data.confirmation) redirect("/cadastro?erro=dados");
  let allowed = false;
  try {
    allowed = await allowAuthAttempt(input.data.email);
  } catch {
    redirect("/cadastro?erro=protecao");
  }
  if (!allowed) redirect("/cadastro?erro=limite");
  let immediateSession = false;
  let registered = false;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      data: { full_name: input.data.name },
      emailRedirectTo: `${await getStoreRequestOrigin()}/auth/callback?next=/minha-conta`,
    },
    });
    registered = !error;
    immediateSession = Boolean(data.session && customerSessionFromUser(data.user));
  } catch { /* Do not expose provider internals. */ }
  if (!registered) redirect("/cadastro?erro=indisponivel");
  if (immediateSession) redirect("/minha-conta");
  redirect("/entrar?status=confirme-email");
}

export async function requestPasswordReset(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) redirect("/recuperar-senha?erro=dados");
  let allowed = false;
  try {
    allowed = await allowAuthAttempt(email.data);
  } catch {
    redirect("/recuperar-senha?erro=protecao");
  }
  if (!allowed) redirect("/recuperar-senha?erro=limite");
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${await getStoreRequestOrigin()}/auth/callback?next=/redefinir-senha`,
    });
  } catch { /* Recovery response never reveals account existence. */ }
  redirect("/entrar?status=recuperacao-enviada");
}

export async function updateCustomerPassword(formData: FormData) {
  const input = z.object({ password: passwordSchema, confirmation: passwordSchema }).safeParse({
    password: formData.get("password"), confirmation: formData.get("confirmation"),
  });
  if (!input.success || input.data.password !== input.data.confirmation) redirect("/redefinir-senha?erro=dados");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!customerSessionFromUser(data.user)) redirect("/entrar?erro=sessao");
  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error) redirect("/redefinir-senha?erro=indisponivel");
  redirect("/minha-conta?status=senha-alterada");
}

export async function loginWithGoogle() {
  if (!isGoogleLoginEnabled()) redirect("/entrar?erro=google");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getStoreRequestOrigin()}/auth/callback?next=/minha-conta`, skipBrowserRedirect: true },
  });
  if (error || !data.url) redirect("/entrar?erro=google");
  redirect(data.url);
}

export async function logoutCustomer() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar?status=saiu");
}
