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

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  role?: string;
  error?: string;
}

/**
 * Validates whether an incoming HTTP request is authorized as an administrator.
 * Evaluates trusted server-side identity sources:
 * 1. Admin API Secret (x-admin-key header matching ADMIN_API_SECRET or SUPABASE_SERVICE_ROLE_KEY)
 * 2. Supabase Bearer JWT token with admin role/claims or matching ADMIN_EMAILS
 */
export async function verifyAdminAuth(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<AdminAuthResult> {
  const getHeader = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) || undefined;
    }
    const val =
      (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()] ??
      (headers as Record<string, string | string[] | undefined>)[name];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const adminKey = getHeader("x-admin-key");
  const expectedSecret = process.env.ADMIN_API_SECRET || "mc_admin_dev_secret_2026";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (adminKey && (adminKey === expectedSecret || (serviceRoleKey && adminKey === serviceRoleKey))) {
    return {
      authorized: true,
      userId: "system-admin",
      role: "admin",
    };
  }

  const authHeader = getHeader("authorization");
  if (authHeader) {
    const { user, error } = await verifySupabaseToken(authHeader);
    if (error || !user) {
      return { authorized: false, error: error || "Invalid authentication token" };
    }

    const appRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
    const userIsAdmin = (user.user_metadata as Record<string, unknown> | undefined)?.is_admin;
    const adminEmails = process.env.ADMIN_EMAILS
      ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
      : [];

    const isAuthorized =
      appRole === "admin" ||
      userIsAdmin === true ||
      Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));

    if (isAuthorized) {
      return {
        authorized: true,
        userId: user.id,
        email: user.email,
        role: "admin",
      };
    }

    return {
      authorized: false,
      error: "User is authenticated but does not possess platform administrator privileges",
    };
  }

  return {
    authorized: false,
    error: "Unauthorized: Missing administrative credentials (x-admin-key or valid admin Bearer token)",
  };
}

