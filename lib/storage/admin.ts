import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig, getSupabaseServiceRoleKey } from "../supabase/config";

export function createStorageAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient(url, getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
