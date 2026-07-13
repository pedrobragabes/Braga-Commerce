"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveSignedInOperator } from "../../lib/admin-auth";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
});

export async function loginAdmin(formData: FormData) {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!input.success) redirect("/admin/login?error=invalid");

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
