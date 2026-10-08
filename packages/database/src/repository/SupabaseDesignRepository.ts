import { CreateDesignInput, DesignDocument, DesignRepository } from "@design-platform/types";
import { getSupabaseClient, SupabaseConfig } from "../client";
import { DesignTableRow } from "../types";

export class SupabaseDesignRepository implements DesignRepository {
  private fallbackRepo?: DesignRepository;
  private config?: SupabaseConfig;
  private hasLoggedMigrationHint: boolean = false;

  constructor(options?: { fallbackRepo?: DesignRepository; config?: SupabaseConfig }) {
    this.fallbackRepo = options?.fallbackRepo;
    this.config = options?.config;
  }

  private mapRowToDocument(row: DesignTableRow): DesignDocument {
    return {
      id: row.id,
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

  private handleFallback<T>(
    err: unknown,
    fallbackAction: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isMissingTable =
      errorMessage.includes("PGRST205") ||
      errorMessage.includes("Could not find the table") ||
      errorMessage.includes('relation "public.designs" does not exist');

    if (isMissingTable && !this.hasLoggedMigrationHint) {
      this.hasLoggedMigrationHint = true;
      console.warn(
        `[SupabaseDesignRepository] 'designs' table not found on Supabase during ${operationName}. ` +
          `Falling back to local storage. Run 'packages/database/src/schema.sql' in your Supabase SQL Editor.`
      );
    }

    if (this.fallbackRepo) {
      return fallbackAction();
    }

    throw err;
  }

  public async list(): Promise<DesignDocument[]> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.list();
      return [];
    }

    try {
      const { data, error } = await client
        .from("designs")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        return this.handleFallback(error, () => this.fallbackRepo!.list(), "list");
      }

      return (data || []).map((row) => this.mapRowToDocument(row as DesignTableRow));
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.list(), "list");
    }
  }

  public async getById(id: string): Promise<DesignDocument | null> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.getById(id);
      return null;
    }

    try {
      const { data, error } = await client.from("designs").select("*").eq("id", id).maybeSingle();

      if (error) {
        return this.handleFallback(error, () => this.fallbackRepo!.getById(id), "getById");
      }

      if (!data) return null;
      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.getById(id), "getById");
    }
  }

  public async create(input: CreateDesignInput): Promise<DesignDocument> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.create(input);
      throw new Error("Supabase is not configured and no fallback repository is available");
    }

    const defaultPage = {
      id: "page-1",
      pageNumber: 1,
      elements: [],
    };

    const newRow = {
      name: input.name,
      width: input.width,
      height: input.height,
      background_color: input.backgroundColor || "#ffffff",
      pages: input.pages && input.pages.length > 0 ? input.pages : [defaultPage],
      favorite: false,
    };

    try {
      const { data, error } = await client.from("designs").insert([newRow]).select().single();

      if (error) {
        return this.handleFallback(error, () => this.fallbackRepo!.create(input), "create");
      }

      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.create(input), "create");
    }
  }

  public async update(id: string, updates: Partial<DesignDocument>): Promise<DesignDocument> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.update(id, updates);
      throw new Error("Supabase is not configured and no fallback repository is available");
    }

    const rowUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) rowUpdates.name = updates.name;
    if (updates.width !== undefined) rowUpdates.width = updates.width;
    if (updates.height !== undefined) rowUpdates.height = updates.height;
    if (updates.backgroundColor !== undefined)
      rowUpdates.background_color = updates.backgroundColor;
    if (updates.pages !== undefined) rowUpdates.pages = updates.pages;
    if (updates.thumbnail !== undefined) rowUpdates.thumbnail = updates.thumbnail;
    if (updates.favorite !== undefined) rowUpdates.favorite = updates.favorite;
    if (updates.description !== undefined) rowUpdates.description = updates.description;
    rowUpdates.updated_at = new Date().toISOString();

    try {
      const { data, error } = await client
        .from("designs")
        .update(rowUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return this.handleFallback(error, () => this.fallbackRepo!.update(id, updates), "update");
      }

      return this.mapRowToDocument(data as DesignTableRow);
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.update(id, updates), "update");
    }
  }

  public async delete(id: string): Promise<void> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.delete(id);
      return;
    }

    try {
      const { error } = await client.from("designs").delete().eq("id", id);
      if (error) {
        return this.handleFallback(error, () => this.fallbackRepo!.delete(id), "delete");
      }
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.delete(id), "delete");
    }
  }

  public async duplicate(id: string): Promise<DesignDocument> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      if (this.fallbackRepo) return this.fallbackRepo.duplicate(id);
      throw new Error("Supabase is not configured and no fallback repository is available");
    }

    try {
      const original = await this.getById(id);
      if (!original) {
        throw new Error(`Design with ID ${id} not found to duplicate`);
      }

      const duplicateInput: CreateDesignInput = {
        name: `${original.name} (Copy)`,
        width: original.width,
        height: original.height,
        backgroundColor: original.backgroundColor,
        pages: JSON.parse(JSON.stringify(original.pages)),
      };

      const duplicated = await this.create(duplicateInput);
      if (original.thumbnail) {
        return await this.update(duplicated.id, { thumbnail: original.thumbnail });
      }
      return duplicated;
    } catch (err) {
      return this.handleFallback(err, () => this.fallbackRepo!.duplicate(id), "duplicate");
    }
  }
}
