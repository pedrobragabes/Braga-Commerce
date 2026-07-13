export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim())?.trim();
}

export function getSupabasePublicConfig() {
  const url = firstConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.DATABASE_SUPABASE_URL,
  );
  const publishableKey = firstConfigured(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_DATABASE_SUPABASE_PUBLISHABLE_KEY,
    process.env.DATABASE_SUPABASE_ANON_KEY,
  );

  if (!url || !publishableKey) {
    throw new SupabaseConfigurationError(
      "Supabase Auth não está configurado neste ambiente.",
    );
  }

  return { url, publishableKey };
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = firstConfigured(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.DATABASE_SUPABASE_SERVICE_ROLE_KEY,
    process.env.DATABASE_SUPABASE_SECRET_KEY,
  );
  if (!serviceRoleKey) {
    throw new SupabaseConfigurationError(
      "A chave server-side do Supabase não está configurada.",
    );
  }
  return serviceRoleKey;
}
