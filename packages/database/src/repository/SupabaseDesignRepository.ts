import { CreateDesignInput, DesignDocument, DesignRepository, sanitizePages } from "@design-platform/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, SupabaseConfig } from "../client.js";
import { DesignTableRow } from "../types.js";

export interface SupabaseDesignRepositoryOptions {
  workspaceId?: string;
  client?: SupabaseClient;
  config?: SupabaseConfig;
  fallbackRepo?: DesignRepository;
}

export class SupabaseDesignRepository implements DesignRepository {
  private workspaceId?: string;
  private client?: SupabaseClient;
  private config?: SupabaseConfig;
  private fallbackRepo?: DesignRepository;

  constructor(options?: SupabaseDesignRepositoryOptions) {
    this.workspaceId = options?.workspaceId;
    this.client = options?.client;
    this.config = options?.config;
    this.fallbackRepo = options?.fallbackRepo;
  }

  public setWorkspaceId(workspaceId?: string): void {
    this.workspaceId = workspaceId;
  }

  public getWorkspaceId(): string | undefined {
    return this.workspaceId;
  }

  private getClient(): SupabaseClient | null {
    if (this.client) return this.client;
    return getSupabaseClient(this.config);
  }

  public mapRowToDocument(row: DesignTableRow): DesignDocument {
    return {
      id: row.id,
      workspaceId: row.workspace_id || undefined,
      name: row.name,
      width: row.width,
      height: row.height,
      backgroundColor: row.background_color || "#ffffff",
      pages: Array.isArray(row.pages) ? row.pages : [],
      thumbnail: row.thumbnail || undefined,
      favorite: Boolean(row.favorite),
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Lists all designs belonging to the workspace.
   * Scoped strictly by workspace_id and enforced by PostgreSQL RLS.
   */
  public async list(workspaceId?: string): Promise<DesignDocument[]> {
    const targetWsId = workspaceId || this.workspaceId;
    // Security check: Unscoped queries are strictly prevented
    if (!targetWsId) {
      return [];
    }

    const client = this.getClient();
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.list(targetWsId);
      return [];
    }

    try {
      const { data, error } = await client
        .from("designs")
        .select("*")
        .eq("workspace_id", targetWsId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[SupabaseDesignRepository] Error listing designs:", error.message);
        throw new Error(`Failed to list designs: ${error.message}`);
      }

      return (data || []).map((row) => this.mapRowToDocument(row as DesignTableRow));
    } catch (err) {
      console.error("[SupabaseDesignRepository] Exception listing designs:", (err as Error)?.message);
      throw err;
    }
  }

  /**
   * Retrieves a single design by ID, verifying workspace membership.
   */
  public async getById(id: string, workspaceId?: string): Promise<DesignDocument | null> {
    if (!id) return null;
    const targetWsId = workspaceId || this.workspaceId;

    const client = this.getClient();
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.getById(id, targetWsId);
      return null;
    }

    try {
      let query = client.from("designs").select("*").eq("id", id);
      if (targetWsId) {
        query = query.eq("workspace_id", targetWsId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("[SupabaseDesignRepository] Error getting design:", error.message);
        throw new Error(`Failed to get design: ${error.message}`);
      }

      if (!data) return null;
      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      console.error("[SupabaseDesignRepository] Exception getting design:", (err as Error)?.message);
      throw err;
    }
  }

  /**
   * Creates a new design inside the designated workspace.
   */
  public async create(input: CreateDesignInput): Promise<DesignDocument> {
    const targetWsId = input.workspaceId || this.workspaceId;
    if (!targetWsId) {
      throw new Error("Cannot create design: workspaceId is required");
    }

    const client = this.getClient();
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.create({ ...input, workspaceId: targetWsId });
      throw new Error("Supabase is not configured and no fallback repository is available");
    }

    const defaultPage = {
      id: "page-1",
      name: "Page 1",
      elements: [],
    };

    const cleanPages = sanitizePages(
      input.pages && input.pages.length > 0 ? input.pages : [defaultPage]
    );

    const newRow = {
      workspace_id: targetWsId,
      name: typeof input.name === "string" && input.name.trim().length > 0 ? input.name.trim() : "Untitled Design",
      width: Number(input.width) || 1200,
      height: Number(input.height) || 800,
      background_color: typeof input.backgroundColor === "string" ? input.backgroundColor : "#ffffff",
      pages: cleanPages,
      favorite: false,
    };

    try {
      const { data, error } = await client.from("designs").insert([newRow]).select().single();

      if (error) {
        console.error("[SupabaseDesignRepository] Error creating design:", error.message);
        throw new Error(`Failed to create design: ${error.message}`);
      }

      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      console.error("[SupabaseDesignRepository] Exception creating design:", (err as Error)?.message);
      throw err;
    }
  }

  /**
   * Updates an existing design within the designated workspace.
   */
  public async update(
    id: string,
    updates: Partial<DesignDocument>,
    workspaceId?: string
  ): Promise<DesignDocument> {
    if (!id) throw new Error("Design ID is required for update");
    const targetWsId = workspaceId || this.workspaceId;

    const client = this.getClient();
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.update(id, updates, targetWsId);
      throw new Error("Supabase is not configured and no fallback repository is available");
    }

    const rowUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) rowUpdates.name = String(updates.name);
    if (updates.width !== undefined) rowUpdates.width = Number(updates.width) || 1200;
    if (updates.height !== undefined) rowUpdates.height = Number(updates.height) || 800;
    if (updates.backgroundColor !== undefined)
      rowUpdates.background_color = String(updates.backgroundColor);
    if (updates.pages !== undefined) rowUpdates.pages = sanitizePages(updates.pages);
    if (updates.thumbnail !== undefined) {
      rowUpdates.thumbnail =
        typeof updates.thumbnail === "string" && updates.thumbnail.length > 0
          ? updates.thumbnail
          : null;
    }
    if (updates.favorite !== undefined) rowUpdates.favorite = Boolean(updates.favorite);
    if (updates.description !== undefined)
      rowUpdates.description = updates.description ? String(updates.description) : null;
    rowUpdates.updated_at = new Date().toISOString();

    try {
      let query = client.from("designs").update(rowUpdates).eq("id", id);
      if (targetWsId) {
        query = query.eq("workspace_id", targetWsId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        console.error("[SupabaseDesignRepository] Error updating design:", error.message);
        throw new Error(`Failed to update design: ${error.message}`);
      }

      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      console.error("[SupabaseDesignRepository] Exception updating design:", (err as Error)?.message);
      throw err;
    }
  }

  /**
   * Deletes a design from the designated workspace.
   */
  public async delete(id: string, workspaceId?: string): Promise<void> {
    if (!id) throw new Error("Design ID is required for delete");
    const targetWsId = workspaceId || this.workspaceId;

    const client = this.getClient();
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.delete(id, targetWsId);
      return;
    }

    try {
      let query = client.from("designs").delete().eq("id", id);
      if (targetWsId) {
        query = query.eq("workspace_id", targetWsId);
      }

      const { error } = await query;
      if (error) {
        console.error("[SupabaseDesignRepository] Error deleting design:", error.message);
        throw new Error(`Failed to delete design: ${error.message}`);
      }
    } catch (err) {
      console.error("[SupabaseDesignRepository] Exception deleting design:", (err as Error)?.message);
      throw err;
    }
  }

  /**
   * Duplicates an existing design into the target workspace.
   */
  public async duplicate(id: string, workspaceId?: string): Promise<DesignDocument> {
    const targetWsId = workspaceId || this.workspaceId;
    const original = await this.getById(id, targetWsId);
    if (!original) {
      throw new Error(`Design with ID ${id} not found to duplicate`);
    }

    const duplicateInput: CreateDesignInput = {
      workspaceId: targetWsId,
      name: `${original.name} (Copy)`,
      width: original.width,
      height: original.height,
      backgroundColor: original.backgroundColor,
      pages: JSON.parse(JSON.stringify(original.pages)),
    };

    const duplicated = await this.create(duplicateInput);
    if (original.thumbnail) {
      return await this.update(duplicated.id, { thumbnail: original.thumbnail }, targetWsId);
    }
    return duplicated;
  }
}
