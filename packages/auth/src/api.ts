import { createClient, type User } from "@supabase/supabase-js";

/**
 * Validates a Bearer token received by backend APIs (e.g., Fastify)
 * against the Supabase Auth server.
 * Returns the authenticated User or null if token is missing or invalid.
 */
export async function verifySupabaseToken(token: string): Promise<{ user: User | null; error?: string }> {
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  if (!cleanToken) {
    return { user: null, error: "Missing or malformed Authorization header" };
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { user: null, error: "Supabase backend configuration is incomplete" };
  }

  try {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await client.auth.getUser(cleanToken);
    if (error || !data.user) {
      return { user: null, error: error?.message || "Invalid or expired token" };
    }

    return { user: data.user };
  } catch (err) {
    return { user: null, error: (err as Error)?.message || "Failed to verify token" };
  }
}
