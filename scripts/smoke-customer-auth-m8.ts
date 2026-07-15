import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicConfig,
  getSupabaseServiceRoleKey,
} from "../lib/supabase/config";

function assertOk(error: { message: string } | null, step: string) {
  if (error) throw new Error(`${step}_FAILED`);
}

async function main() {
  const { url, publishableKey } = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID();
  const confirmedEmail = `m8-confirmed-${suffix}@example.com`;
  const pendingEmail = `m8-pending-${suffix}@example.com`;
  const oldPassword = `${randomBytes(18).toString("base64url")}aA1!`;
  const newPassword = `${randomBytes(18).toString("base64url")}bB2!`;
  const createdIds: string[] = [];

  try {
    const confirmed = await admin.auth.admin.createUser({
      email: confirmedEmail,
      password: oldPassword,
      email_confirm: true,
      user_metadata: { full_name: "M8 Auth Smoke" },
    });
    assertOk(confirmed.error, "CREATE_CONFIRMED_USER");
    if (!confirmed.data.user) throw new Error("CREATE_CONFIRMED_USER_EMPTY");
    createdIds.push(confirmed.data.user.id);

    const login = await client.auth.signInWithPassword({
      email: confirmedEmail,
      password: oldPassword,
    });
    assertOk(login.error, "LOGIN_CONFIRMED_USER");
    if (!login.data.session) throw new Error("LOGIN_SESSION_EMPTY");

    const current = await client.auth.getUser();
    assertOk(current.error, "GET_AUTHENTICATED_USER");
    if (current.data.user?.id !== confirmed.data.user.id) {
      throw new Error("AUTHENTICATED_USER_MISMATCH");
    }

    const updated = await client.auth.updateUser({ password: newPassword });
    assertOk(updated.error, "UPDATE_PASSWORD");
    assertOk((await client.auth.signOut()).error, "SIGN_OUT");

    const oldLogin = await client.auth.signInWithPassword({
      email: confirmedEmail,
      password: oldPassword,
    });
    if (!oldLogin.error) throw new Error("OLD_PASSWORD_STILL_ACCEPTED");

    const newLogin = await client.auth.signInWithPassword({
      email: confirmedEmail,
      password: newPassword,
    });
    assertOk(newLogin.error, "LOGIN_WITH_NEW_PASSWORD");
    assertOk((await client.auth.signOut()).error, "FINAL_SIGN_OUT");

    const pending = await admin.auth.admin.createUser({
      email: pendingEmail,
      password: oldPassword,
      email_confirm: false,
    });
    assertOk(pending.error, "CREATE_PENDING_USER");
    if (!pending.data.user) throw new Error("CREATE_PENDING_USER_EMPTY");
    createdIds.push(pending.data.user.id);

    const pendingLogin = await client.auth.signInWithPassword({
      email: pendingEmail,
      password: oldPassword,
    });
    if (!pendingLogin.error || pendingLogin.data.session) {
      throw new Error("UNCONFIRMED_EMAIL_ACCEPTED");
    }

    console.info(JSON.stringify({
      createdConfirmedUser: true,
      login: true,
      getUser: true,
      passwordChanged: true,
      oldPasswordRejected: true,
      logout: true,
      unconfirmedEmailRejected: true,
    }));
  } finally {
    await Promise.all(createdIds.map(async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("AUTH_SMOKE_CLEANUP_FAILED");
    }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AUTH_SMOKE_FAILED");
  process.exitCode = 1;
});
