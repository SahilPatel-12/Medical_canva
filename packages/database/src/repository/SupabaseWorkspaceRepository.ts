import {
  Workspace,
  WorkspaceMember,
  WorkspaceWithRole,
  WorkspaceRole,
  WorkspaceInvitation,
  CreateInvitationInput,
  InvitationDetails,
} from "@design-platform/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, SupabaseConfig } from "../client";
import {
  WorkspaceTableRow,
  WorkspaceMemberTableRow,
  WorkspaceInvitationTableRow,
} from "../types";

function generateSecureToken(byteLength = 32): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const chars = "abcdef0123456789";
  let token = "";
  for (let i = 0; i < byteLength * 2; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export class SupabaseWorkspaceRepository {
  private config?: SupabaseConfig;
  private client?: SupabaseClient;

  constructor(options?: { config?: SupabaseConfig; client?: SupabaseClient }) {
    this.config = options?.config;
    this.client = options?.client;
  }

  private getClient(): SupabaseClient | null {
    if (this.client) return this.client;
    return getSupabaseClient(this.config);
  }

  public mapRowToWorkspace(row: WorkspaceTableRow): Workspace {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public mapRowToMember(row: WorkspaceMemberTableRow): WorkspaceMember {
    return {
      workspaceId: row.workspace_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Retrieves all workspaces that the authenticated user belongs to.
   * Joins workspace_members to include the caller's role in each workspace.
   */
  public async listMyWorkspaces(): Promise<WorkspaceWithRole[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("workspace_members")
        .select(`
          role,
          workspaces:workspace_id (
            id,
            name,
            slug,
            type,
            created_by,
            created_at,
            updated_at
          )
        `);

      if (error || !data) {
        console.warn("[SupabaseWorkspaceRepository] Error listing workspaces:", error?.message);
        return [];
      }

      const results: WorkspaceWithRole[] = [];
      for (const item of data as Array<{ role: string; workspaces: unknown }>) {
        if (item.workspaces) {
          const ws = item.workspaces as WorkspaceTableRow;
          results.push({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            type: ws.type,
            createdBy: ws.created_by,
            createdAt: ws.created_at,
            updatedAt: ws.updated_at,
            role: item.role as WorkspaceRole,
          });
        }
      }
      return results;
    } catch (err) {
      console.warn("[SupabaseWorkspaceRepository] Exception listing workspaces:", (err as Error)?.message);
      return [];
    }
  }

  /**
   * Retrieves a single workspace by ID. Respects RLS (returns null if caller is not a member).
   */
  public async getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();

      if (error || !data) return null;
      return this.mapRowToWorkspace(data as WorkspaceTableRow);
    } catch (err) {
      console.warn(`[SupabaseWorkspaceRepository] Exception fetching workspace ${workspaceId}:`, err);
      return null;
    }
  }

  /**
   * Retrieves the caller's membership record in a specific workspace.
   */
  public async getMyMembership(workspaceId: string): Promise<WorkspaceMember | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data: userData } = await client.auth.getUser();
      if (!userData?.user) return null;

      const { data, error } = await client
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (error || !data) return null;
      return this.mapRowToMember(data as WorkspaceMemberTableRow);
    } catch (err) {
      console.warn(`[SupabaseWorkspaceRepository] Exception fetching membership:`, err);
      return null;
    }
  }

  /**
   * Retrieves all members of a workspace.
   */
  public async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("workspace_members")
        .select(`
          workspace_id,
          user_id,
          role,
          created_at,
          updated_at,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("workspace_id", workspaceId);

      if (error || !data) return [];

      type MemberQueryRow = {
        workspace_id: string;
        user_id: string;
        role: string;
        created_at: string;
        updated_at: string;
        profiles?: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        } | null | Array<{
          id: string;
          display_name: string | null;
          avatar_url: string | null;
        }>;
      };

      return (data as unknown as MemberQueryRow[]).map((row) => {
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          workspaceId: row.workspace_id,
          userId: row.user_id,
          role: row.role as WorkspaceRole,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          user: prof
            ? {
                id: prof.id,
                displayName: prof.display_name,
                avatarUrl: prof.avatar_url,
              }
            : undefined,
        };
      });
    } catch (err) {
      console.warn(`[SupabaseWorkspaceRepository] Exception fetching members:`, err);
      return [];
    }
  }

  /**
   * Idempotently ensures the user has a personal workspace via database RPC.
   * If the personal workspace already exists, returns it.
   */
  public async ensurePersonalWorkspace(user: { id: string; displayName?: string }): Promise<WorkspaceWithRole> {
    if (!user || !user.id) {
      throw new Error("User must be provided");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const defaultName = user.displayName
      ? `${user.displayName.trim()}'s Workspace`
      : "Personal Workspace";

    // 1. First check if personal workspace already exists
    const myWorkspaces = await this.listMyWorkspaces();
    const existingPersonal = myWorkspaces.find((ws) => ws.type === "personal");
    if (existingPersonal) {
      return existingPersonal;
    }

    // 2. Call transactional database function provision_personal_workspace
    const { data: wsId, error: rpcError } = await client.rpc("provision_personal_workspace", {
      target_user_id: user.id,
      workspace_name: defaultName,
    });

    if (rpcError) {
      throw new Error(`Failed to provision personal workspace: ${rpcError.message}`);
    }

    const ws = await this.getWorkspaceById(wsId as string);
    if (!ws) {
      throw new Error("Personal workspace created but could not be retrieved");
    }

    return {
      ...ws,
      role: "owner",
    };
  }

  /**
   * Creates a team workspace atomically via database RPC.
   */
  public async createTeamWorkspace(input: { name: string; slug?: string }): Promise<WorkspaceWithRole> {
    if (!input || !input.name || !input.name.trim()) {
      throw new Error("Workspace name cannot be empty");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data: wsId, error } = await client.rpc("create_workspace", {
      name: input.name,
      type: "team",
      slug: input.slug || null,
    });

    if (error) {
      throw new Error(`Failed to create team workspace: ${error.message}`);
    }

    const ws = await this.getWorkspaceById(wsId as string);
    if (!ws) {
      throw new Error("Team workspace created but could not be retrieved");
    }

    return {
      ...ws,
      role: "owner",
    };
  }

  /**
   * Retrieves all invitations for a workspace. Respects RLS (accessible by owners/admins).
   */
  public async listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from("workspace_invitations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error || !data) {
        console.warn("[SupabaseWorkspaceRepository] Error listing invitations:", error?.message);
        return [];
      }

      return (data as WorkspaceInvitationTableRow[]).map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        email: row.email,
        role: row.role,
        invitedBy: row.invited_by,
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.warn("[SupabaseWorkspaceRepository] Exception listing invitations:", (err as Error)?.message);
      return [];
    }
  }

  /**
   * Creates an invitation via the transactional create_workspace_invitation RPC.
   * Generates a high-entropy random token, sends it for hashing, and returns the raw token to the caller.
   */
  public async createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    if (!input || !input.workspaceId || !input.email || !input.role) {
      throw new Error("Missing required invitation fields");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const rawToken = generateSecureToken(32);

    const { data, error } = await client.rpc("create_workspace_invitation", {
      p_workspace_id: input.workspaceId,
      p_email: input.email.trim(),
      p_role: input.role,
      p_raw_token: rawToken,
    });

    if (error || !data) {
      throw new Error(error?.message || "Failed to create invitation");
    }

    const parsed = data as {
      id: string;
      workspace_id: string;
      email: string;
      role: "admin" | "editor" | "viewer";
      status: "pending" | "accepted" | "revoked" | "expired";
      expires_at: string;
      created_at: string;
    };

    return {
      id: parsed.id,
      workspaceId: parsed.workspace_id,
      email: parsed.email,
      role: parsed.role,
      invitedBy: "",
      status: parsed.status,
      expiresAt: parsed.expires_at,
      createdAt: parsed.created_at,
      updatedAt: parsed.created_at,
      token: rawToken,
    };
  }

  /**
   * Revokes a pending invitation via the revoke_workspace_invitation RPC.
   */
  public async revokeInvitation(invitationId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { error } = await client.rpc("revoke_workspace_invitation", {
      p_invitation_id: invitationId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Retrieves safe invitation metadata for display on the invitation acceptance page.
   */
  public async getInvitationDetails(rawToken: string): Promise<InvitationDetails | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.rpc("get_invitation_details", {
        p_raw_token: rawToken,
      });

      if (error || !data) return null;

      const res = data as {
        id: string;
        workspace_id: string;
        workspace_name: string;
        email: string;
        role: "admin" | "editor" | "viewer";
        status: "pending" | "accepted" | "revoked" | "expired";
        expires_at: string;
      };

      return {
        id: res.id,
        workspaceId: res.workspace_id,
        workspaceName: res.workspace_name,
        email: res.email,
        role: res.role,
        status: res.status,
        expiresAt: res.expires_at,
      };
    } catch {
      return null;
    }
  }

  /**
   * Accepts a workspace invitation via the accept_workspace_invitation RPC.
   * Atomically verifies email match, expiry, updates invitation status, and adds membership.
   */
  public async acceptInvitation(rawToken: string): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data: wsId, error } = await client.rpc("accept_workspace_invitation", {
      p_raw_token: rawToken,
    });

    if (error || !wsId) {
      throw new Error(error?.message || "Failed to accept invitation");
    }

    return wsId as string;
  }

  /**
   * Updates an existing member's role via the update_workspace_member_role RPC.
   * Enforces owner protection and permission boundaries.
   */
  public async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    newRole: "admin" | "editor" | "viewer"
  ): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { error } = await client.rpc("update_workspace_member_role", {
      p_workspace_id: workspaceId,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Removes a member from the workspace via the remove_workspace_member RPC.
   * Prevents removing the owner.
   */
  public async removeMember(workspaceId: string, targetUserId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { error } = await client.rpc("remove_workspace_member", {
      p_workspace_id: workspaceId,
      p_target_user_id: targetUserId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }
}
