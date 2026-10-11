import { createClient, type SupabaseClient, type User, type Session } from "@supabase/supabase-js";
import type { SignInInput, SignUpInput, AuthResult } from "./types";
export type { SupabaseClient };

let cachedTabClient: SupabaseClient | null = null;
let currentTabId: string | null = null;

/**
 * Resolves or initializes a unique tab identifier for the current browser window/tab.
 * Utilizes window.name (which persists on page reloads within the same tab, but is unique per window)
 * and falls back to window.sessionStorage.
 */
export function getTabId(): string {
  if (typeof window === "undefined") return "server";
  try {
    if (window.name && window.name.startsWith("dp_tab_")) {
      return window.name;
    }
    const stored = window.sessionStorage.getItem("__dp_tab_id__");
    if (stored && stored.startsWith("dp_tab_")) {
      window.name = stored;
      return stored;
    }
    const newTabId = "dp_tab_" + Math.random().toString(36).substring(2, 10);
    window.name = newTabId;
    window.sessionStorage.setItem("__dp_tab_id__", newTabId);
    return newTabId;
  } catch {
    return "dp_tab_fallback";
  }
}

/**
 * Returns a tab-isolated Supabase client instance.
 * Uses window.sessionStorage partitioned by tabId.
 * Sets storageKey to `sb_auth_${tabId}`, which automatically isolates both
 * the stored tokens and the GoTrue BroadcastChannel channel per tab.
 */
export function getBrowserSupabaseClient(explicitTabId?: string): SupabaseClient {
  const tabId = explicitTabId || getTabId();

  if (cachedTabClient && currentTabId === tabId) {
    return cachedTabClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[Auth Error] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in browser client environment."
    );
  }

  if (typeof window === "undefined") {
    return createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const storageKey = `sb_auth_${tabId}`;

  const client = createClient(url, anonKey, {
    auth: {
      storage: window.sessionStorage,
      storageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  cachedTabClient = client;
  currentTabId = tabId;

  return client;
}

/**
 * Signs in a user using email and password.
 */
export async function signInWithPassword(
  input: SignInInput,
  client: SupabaseClient = getBrowserSupabaseClient()
): Promise<AuthResult<Session>> {
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });

    if (error) {
      return {
        error: {
          message: error.message,
          status: error.status,
        },
      };
    }

    return { data: data.session };
  } catch (err) {
    return {
      error: {
        message: (err as Error)?.message || "An unexpected error occurred during sign in.",
      },
    };
  }
}

/**
 * Registers a new user using email, password, and optional display name.
 */
export async function signUpWithPassword(
  input: SignUpInput,
  client: SupabaseClient = getBrowserSupabaseClient()
): Promise<AuthResult<{ user: User | null; session: Session | null }>> {
  try {
    const { data, error } = await client.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          display_name: input.displayName?.trim() || undefined,
          full_name: input.displayName?.trim() || undefined,
        },
      },
    });

    if (error) {
      return {
        error: {
          message: error.message,
          status: error.status,
        },
      };
    }

    return {
      data: {
        user: data.user,
        session: data.session,
      },
    };
  } catch (err) {
    return {
      error: {
        message: (err as Error)?.message || "An unexpected error occurred during sign up.",
      },
    };
  }
}

/**
 * Signs out the currently authenticated user and clears session state.
 */
export async function signOut(
  client: SupabaseClient = getBrowserSupabaseClient()
): Promise<AuthResult<void>> {
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return {
        error: {
          message: error.message,
          status: error.status,
        },
      };
    }
    return {};
  } catch (err) {
    return {
      error: {
        message: (err as Error)?.message || "An unexpected error occurred during sign out.",
      },
    };
  }
}

/**
 * Retrieves the currently authenticated user from the client session.
 */
export async function getCurrentUser(
  client: SupabaseClient = getBrowserSupabaseClient()
): Promise<User | null> {
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Retrieves the active session.
 */
export async function getCurrentSession(
  client: SupabaseClient = getBrowserSupabaseClient()
): Promise<Session | null> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
  } catch {
    return null;
  }
}
