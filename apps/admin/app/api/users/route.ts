import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@design-platform/auth";
import { getSupabaseAdminClient } from "@design-platform/database";
import type { AdminUser, AdminUserWorkspace, UsersResponse } from "../../users/types";

export const dynamic = "force-dynamic";

const BUILT_IN_DEV_SECRET = "mc_admin_dev_secret_2026";
const PAGE = 1000;

const fail = (status: number, code: string, error: string) =>
  NextResponse.json<UsersResponse>({ success: false, code, error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Every signed-up user with their profile, workspaces and design counts.
 * Admin only: it returns email addresses, so it needs the service-role key server-side.
 */
export async function GET(request: NextRequest) {
  // The built-in dev key is visible in the browser bundle; never let it unlock user data in production
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.ADMIN_API_SECRET &&
    request.headers.get("x-admin-key") === BUILT_IN_DEV_SECRET
  ) {
    return fail(401, "default_secret_in_production", "Set ADMIN_API_SECRET on the server to view users in production.");
  }

  const auth = await verifyAdminAuth(request.headers);
  if (!auth.authorized) {
    return fail(401, "unauthorized", auth.error || "Administrative authorization required");
  }

  let db: ReturnType<typeof getSupabaseAdminClient>;
  try {
    db = getSupabaseAdminClient();
  } catch (err) {
    return fail(503, "service_key_missing", (err as Error).message);
  }

  try {
    // 1. Auth accounts (paged by the Admin API)
    const authUsers = [];
    for (let page = 1; ; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw error;
      authUsers.push(...data.users);
      if (data.users.length < PAGE) break;
    }

    // 2. Profiles, memberships and designs (select only what is counted)
    const [profilesRes, membersRes] = await Promise.all([
      db.from("profiles").select("id, display_name, avatar_url"),
      db.from("workspace_members").select("user_id, role, workspace_id, workspaces(id, name, type)"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (membersRes.error) throw membersRes.error;

    const designsPerWorkspace = new Map<string, number>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("designs").select("workspace_id").range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of data as Array<{ workspace_id: string | null }>) {
        if (row.workspace_id) designsPerWorkspace.set(row.workspace_id, (designsPerWorkspace.get(row.workspace_id) || 0) + 1);
      }
      if (data.length < PAGE) break;
    }

    const profiles = new Map(
      (profilesRes.data as Array<{ id: string; display_name: string | null; avatar_url: string | null }>).map((p) => [p.id, p])
    );

    type MemberRow = {
      user_id: string;
      role: AdminUserWorkspace["role"];
      workspace_id: string;
      workspaces: { id: string; name: string; type: AdminUserWorkspace["type"] } | Array<{ id: string; name: string; type: AdminUserWorkspace["type"] }> | null;
    };
    const workspacesByUser = new Map<string, AdminUserWorkspace[]>();
    for (const m of membersRes.data as unknown as MemberRow[]) {
      const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
      const list = workspacesByUser.get(m.user_id) || [];
      list.push({
        id: m.workspace_id,
        name: ws?.name || "Untitled workspace",
        type: ws?.type || "personal",
        role: m.role,
        designCount: designsPerWorkspace.get(m.workspace_id) || 0,
      });
      workspacesByUser.set(m.user_id, list);
    }

    const now = Date.now();
    const users: AdminUser[] = authUsers.map((u) => {
      const meta = (u.user_metadata || {}) as Record<string, unknown>;
      const profile = profiles.get(u.id);
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      const workspaces = (workspacesByUser.get(u.id) || []).sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "personal" ? -1 : 1
      );
      const bannedUntil = u.banned_until && Date.parse(u.banned_until) > now ? u.banned_until : null;
      const providers = Array.isArray(u.app_metadata?.providers)
        ? (u.app_metadata.providers as string[])
        : u.app_metadata?.provider
          ? [String(u.app_metadata.provider)]
          : [];
      return {
        id: u.id,
        email: u.email ?? null,
        name:
          str(profile?.display_name) ||
          str(meta.full_name) ||
          str(meta.name) ||
          str(meta.display_name) ||
          (u.email ? u.email.split("@")[0]! : "Unnamed user"),
        avatarUrl: str(profile?.avatar_url) || str(meta.avatar_url) || str(meta.picture),
        providers,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        bannedUntil,
        status: bannedUntil ? "banned" : u.email_confirmed_at ? "active" : "unverified",
        workspaces,
        designCount: workspaces.filter((w) => w.role === "owner").reduce((n, w) => n + w.designCount, 0),
      };
    });

    users.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return NextResponse.json<UsersResponse>({ success: true, data: users }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/users error]:", err);
    return fail(500, "query_failed", (err as Error).message || "Could not load users");
  }
}
