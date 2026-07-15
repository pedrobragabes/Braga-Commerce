import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";

export type CustomerSession = {
  authUserId: string;
  email: string;
  name: string;
};

export function safeAccountRedirect(value: string | null | undefined, fallback = "/minha-conta") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://account.local");
    if (parsed.origin !== "https://account.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function customerSessionFromUser(user: SupabaseUser | null): CustomerSession | null {
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email || !user.email_confirmed_at) return null;
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return {
    authUserId: user.id,
    email,
    name: typeof metadataName === "string" && metadataName.trim() ? metadataName.trim() : email.split("@")[0],
  };
}

export const getCustomerSession = cache(async (): Promise<CustomerSession | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return customerSessionFromUser(data.user);
});

export async function requireCustomerSession() {
  const session = await getCustomerSession();
  if (!session) redirect("/entrar?next=/minha-conta");
  return session;
}
