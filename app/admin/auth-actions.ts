"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { resolveSignedInOperator } from "../../lib/admin-auth";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import {
  checkRateLimitIdentifier,
  getClientAddressFromHeaders,
  rateLimitPolicies,
} from "../../lib/rate-limit";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
});

export async function loginAdmin(formData: FormData) {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!input.success) redirect("/admin/login?error=invalid");

  let loginAllowed = false;
  try {
    const requestHeaders = await headers();
    const clientAddress = getClientAddressFromHeaders(requestHeaders);
    const [ipBucket, accountBucket] = await Promise.all([
      checkRateLimitIdentifier(clientAddress, rateLimitPolicies.adminLoginIp),
      checkRateLimitIdentifier(input.data.email, rateLimitPolicies.adminLoginAccount),
    ]);
    loginAllowed = ipBucket.allowed && accountBucket.allowed;
  } catch {
    redirect("/admin/login?error=protection");
  }
  if (!loginAllowed) redirect("/admin/login?error=rate-limited");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.user) redirect("/admin/login?error=credentials");

  const operator = await resolveSignedInOperator(data.user);
  if (!operator) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorized");
  }
  redirect("/admin");
}

export async function logoutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
