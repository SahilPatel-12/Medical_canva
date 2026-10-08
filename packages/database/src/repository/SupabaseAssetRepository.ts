import { Asset, ElementType } from "@design-platform/types";
import { getSupabaseClient, SupabaseConfig } from "../client";
import { AssetTableInsert, AssetTableRow, AssetTableUpdate } from "../types";

export class SupabaseAssetRepository {
  private config?: SupabaseConfig;
  private hasLoggedMigrationHint: boolean = false;

  constructor(options?: { config?: SupabaseConfig }) {
    this.config = options?.config;
  }

  public mapRowToAsset(row: AssetTableRow): Asset {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      type: (row.type as ElementType) || "svg",
      source: row.svg_content || row.public_url,
      url: row.public_url,
      r2Key: row.r2_key,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes || 0),
      defaultWidth: row.width || 120,
      defaultHeight: row.height || 120,
      tags: Array.isArray(row.tags) ? row.tags : [],
      thumbnail: row.thumbnail_url || row.public_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private handleMissingTable(err: unknown, operationName: string): void {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isMissingTable =
      errorMessage.includes("PGRST205") ||
      errorMessage.includes("Could not find the table") ||
      errorMessage.includes('relation "public.assets" does not exist');

    if (isMissingTable && !this.hasLoggedMigrationHint) {
      this.hasLoggedMigrationHint = true;
      console.warn(
        `[SupabaseAssetRepository] 'assets' table not found on Supabase during ${operationName}. ` +
          `Execute migration 'infrastructure/supabase/migrations/002_create_assets_table.sql' in your Supabase SQL Editor.`
      );
    }
  }

  public async list(options?: { category?: string; search?: string }): Promise<Asset[]> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      return [];
    }

    try {
      let query = client.from("assets").select("*").order("created_at", { ascending: false });

      if (options?.category && options.category !== "all") {
        query = query.eq("category", options.category);
      }

      if (options?.search && options.search.trim()) {
        const term = options.search.trim();
        query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) {
        this.handleMissingTable(error, "list");
        return [];
      }

      return (data as AssetTableRow[]).map((r) => this.mapRowToAsset(r));
    } catch (err) {
      this.handleMissingTable(err, "list");
      return [];
    }
  }

  public async getById(id: string): Promise<Asset | null> {
    const client = getSupabaseClient(this.config);
    if (!client) return null;

    try {
      const { data, error } = await client.from("assets").select("*").eq("id", id).maybeSingle();
      if (error) {
        this.handleMissingTable(error, "getById");
        return null;
      }
      return data ? this.mapRowToAsset(data as AssetTableRow) : null;
    } catch (err) {
      this.handleMissingTable(err, "getById");
      return null;
    }
  }

  public async create(input: AssetTableInsert): Promise<Asset> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data, error } = await client
      .from("assets")
      .insert({
        id: input.id || `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: input.name,
        category: input.category || "science",
        type: input.type || "svg",
        r2_key: input.r2_key,
        public_url: input.public_url,
        content_type: input.content_type || "image/svg+xml",
        size_bytes: input.size_bytes || 0,
        width: input.width || 120,
        height: input.height || 120,
        tags: input.tags || [],
        svg_content: input.svg_content || null,
        thumbnail_url: input.thumbnail_url || null,
      })
      .select()
      .single();

    if (error) {
      this.handleMissingTable(error, "create");
      const isMissingTable =
        error.message.includes("PGRST205") ||
        error.message.includes("Could not find the table") ||
        error.message.includes('relation "public.assets" does not exist');
      if (isMissingTable) {
        throw new Error(
          "Supabase table 'public.assets' has not been created yet. Please execute 'infrastructure/supabase/migrations/002_create_assets_table.sql' in your Supabase SQL Editor."
        );
      }
      throw new Error(`Failed to create asset in Supabase: ${error.message}`);
    }

    return this.mapRowToAsset(data as AssetTableRow);
  }

  public async update(id: string, updates: AssetTableUpdate): Promise<Asset> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data, error } = await client
      .from("assets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update asset in Supabase: ${error.message}`);
    }

    return this.mapRowToAsset(data as AssetTableRow);
  }

  public async delete(id: string): Promise<AssetTableRow | null> {
    const client = getSupabaseClient(this.config);
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    // Get asset record first so caller can delete from R2 if needed
    const { data: existing } = await client
      .from("assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { error } = await client.from("assets").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete asset from Supabase: ${error.message}`);
    }

    return (existing as AssetTableRow) || null;
  }

  public async getCategories(): Promise<string[]> {
    const client = getSupabaseClient(this.config);
    if (!client) return ["science", "shapes", "icons", "illustrations"];

    try {
      const { data, error } = await client.from("assets").select("category");
      if (error || !data) {
        return ["science", "shapes", "icons", "illustrations"];
      }

      const set = new Set<string>(["science", "shapes", "icons", "illustrations"]);
      data.forEach((row: { category?: string }) => {
        if (row.category) set.add(row.category);
      });

      return Array.from(set);
    } catch {
      return ["science", "shapes", "icons", "illustrations"];
    }
  }
}
