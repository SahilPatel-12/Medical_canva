import { createClient, SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";
export type { SupabaseClient, RealtimeChannel };


let cachedClient: SupabaseClient | null = null;

export interface SupabaseConfig {
  url?: string;
  key?: string;
}

/**
 * Resolves Supabase credentials from explicit config or environment variables
 */
export function getSupabaseCredentials(
  config?: SupabaseConfig
): { url: string; key: string } | null {
  const url =
    config?.url ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const key =
    config?.key ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

/**
 * Checks whether Supabase is configured with valid credentials
 */
export function isSupabaseConfigured(config?: SupabaseConfig): boolean {
  return getSupabaseCredentials(config) !== null;
}

/**
 * Returns a Supabase client instance
 */
export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  if (cachedClient && !config) {
    return cachedClient;
  }

  const credentials = getSupabaseCredentials(config);
  if (!credentials) {
    return null;
  }

  const isBrowser = typeof globalThis !== "undefined" && "window" in globalThis;

  const client = createClient(credentials.url, credentials.key, {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
    },
  });

  if (!config) {
    cachedClient = client;
  }

  return client;
}

/**
 * Creates a user-scoped Supabase client that forwards the caller's JWT in Authorization header.
 * All queries executed with this client are evaluated under the user's role and PostgreSQL RLS.
 */
export function createUserScopedClient(authToken?: string, customConfig?: SupabaseConfig): SupabaseClient {
  const creds = getSupabaseCredentials(customConfig);
  if (!creds) {
    throw new Error("[Supabase Config Error] Missing Supabase URL or Anon Key.");
  }

  return createClient(creds.url, creds.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    },
  });
}

/**
 * Privileged Supabase client instance using the server-only service-role key.
 * This client bypasses Row Level Security (RLS) and MUST NEVER be exposed to browser clients.
 * Throws immediately if invoked in a browser/client environment.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    throw new Error(
      "[Security Error] getSupabaseAdminClient() can only be called in server-side environments."
    );
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "[Supabase Config Error] Missing SUPABASE_URL server environment variable."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "[Supabase Config Error] Missing required SUPABASE_SERVICE_ROLE_KEY server environment variable."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

