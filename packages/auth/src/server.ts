import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User, Session } from "@supabase/supabase-js";

export interface CookieItem {
  name: string;
  value: string;
}

export interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export interface CookieAdapter {
  getAll: () => CookieItem[] | Promise<CookieItem[]>;
  setAll?: (cookies: CookieToSet[]) => void | Promise<void>;
}

/**
 * Creates a server-side Supabase client with cookie-based session handling.
 * Safe for Next.js Server Components, Server Actions, Route Handlers, and Middleware.
 */
export function createServerSupabaseClient(cookies: CookieAdapter): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[Auth Config Error] Supabase URL and anon key are required for server Supabase client."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      async getAll() {
        return await cookies.getAll();
      },
      async setAll(cookiesToSet) {
        if (cookies.setAll) {
          await cookies.setAll(cookiesToSet);
        }
      },
    },
  });
}

/**
 * Fetches the authenticated user on the server.
 * Uses auth.getUser() which verifies the JWT token with Supabase auth server.
 */
export async function getServerUser(cookies: CookieAdapter): Promise<User | null> {
  try {
    const client = createServerSupabaseClient(cookies);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Fetches the current session on the server.
 */
export async function getServerSession(cookies: CookieAdapter): Promise<Session | null> {
  try {
    const client = createServerSupabaseClient(cookies);
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
  } catch {
    return null;
  }
}
