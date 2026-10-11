import {
  DesignShareLink,
  SharedDesignDetails,
  UpdateShareLinkInput,
  DesignDocument,
  Page,
} from "@design-platform/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, SupabaseConfig } from "../client.js";

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

export class SupabaseShareRepository {
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

  /**
   * Retrieves or initializes the share link configuration for a design.
   * Requires caller to have owner, admin, or editor role in the design's workspace.
   */
  public async getOrCreateShareLink(designId: string): Promise<DesignShareLink> {
    if (!designId) {
      throw new Error("Design ID is required");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const rawToken = generateSecureToken(32);

    const { data, error } = await client.rpc("get_or_create_design_share_link", {
      p_design_id: designId,
      p_raw_token: rawToken,
    });

    if (error || !data) {
      const details = error
        ? `${error.message}${error.details ? ` (${error.details})` : ""}${error.hint ? ` [Hint: ${error.hint}]` : ""}`
        : "Failed to get or create share link: No data returned";
      console.error("[SupabaseShareRepository.getOrCreateShareLink] RPC error:", details);
      throw new Error(details);
    }

    const parsed = data as {
      id: string;
      design_id: string;
      token: string;
      permission: "view" | "edit";
      is_enabled: boolean;
      expires_at: string | null;
      created_at: string;
      updated_at: string;
    };

    return {
      id: parsed.id,
      designId: parsed.design_id,
      token: parsed.token,
      permission: parsed.permission,
      isEnabled: parsed.is_enabled,
      expiresAt: parsed.expires_at,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }

  /**
   * Updates an existing share link: enables/disables public link access,
   * alters the granted permission level (view vs edit), or rotates the access token.
   */
  public async updateShareLink(input: UpdateShareLinkInput): Promise<DesignShareLink> {
    if (!input || !input.designId) {
      throw new Error("Missing designId for share link update");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const newRawToken = input.regenerateToken ? generateSecureToken(32) : null;

    const { data, error } = await client.rpc("update_design_share_link", {
      p_design_id: input.designId,
      p_is_enabled: input.isEnabled,
      p_permission: input.permission,
      p_regenerate_token: Boolean(input.regenerateToken),
      p_new_raw_token: newRawToken,
    });

    if (error || !data) {
      const details = error
        ? `${error.message}${error.details ? ` (${error.details})` : ""}${error.hint ? ` [Hint: ${error.hint}]` : ""}`
        : "Failed to update share link: No data returned";
      console.error("[SupabaseShareRepository.updateShareLink] RPC error:", details);
      throw new Error(details);
    }

    const parsed = data as {
      id: string;
      design_id: string;
      token: string;
      permission: "view" | "edit";
      is_enabled: boolean;
      expires_at: string | null;
      created_at: string;
      updated_at: string;
    };

    return {
      id: parsed.id,
      designId: parsed.design_id,
      token: parsed.token,
      permission: parsed.permission,
      isEnabled: parsed.is_enabled,
      expiresAt: parsed.expires_at,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
    };
  }

  /**
   * Resolves a public share token.
   * Safe for anonymous viewers; never returns private workspace IDs or user account information.
   * Returns null if token is invalid, revoked, disabled, or expired.
   */
  public async getSharedDesign(rawToken: string): Promise<SharedDesignDetails | null> {
    if (!rawToken || !rawToken.trim()) return null;

    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.rpc("get_shared_design_by_token", {
        p_raw_token: rawToken.trim(),
      });

      if (error || !data) return null;

      const parsed = data as {
        design: DesignDocument;
        permission: "view" | "edit";
        share_id: string;
      };

      return {
        design: parsed.design,
        permission: parsed.permission,
        shareId: parsed.share_id,
      };
    } catch (err) {
      console.warn("[SupabaseShareRepository] Error getting shared design:", (err as Error)?.message);
      return null;
    }
  }

  /**
   * Updates shared design content for an authenticated editor-link recipient.
   * Validates active token, edit permission, and non-expired state on the server.
   */
  public async updateSharedDesignContent(
    designId: string,
    rawToken: string,
    pages: Page[],
    thumbnail?: string
  ): Promise<DesignDocument> {
    if (!designId || !rawToken) {
      throw new Error("Missing designId or share token for shared update");
    }

    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data, error } = await client.rpc("update_shared_design_content", {
      p_design_id: designId,
      p_raw_token: rawToken.trim(),
      p_pages: pages,
      p_thumbnail: thumbnail || null,
    });

    if (error || !data) {
      const details = error
        ? `${error.message}${error.details ? ` (${error.details})` : ""}${error.hint ? ` [Hint: ${error.hint}]` : ""}`
        : "Failed to update shared design content: No data returned";
      console.error("[SupabaseShareRepository.updateSharedDesignContent] RPC error:", details);
      throw new Error(details);
    }

    return data as DesignDocument;
  }
}
