import { Asset, ElementType } from "@design-platform/types";
import { getSupabaseClient, getSupabaseAdminClient, SupabaseClient, SupabaseConfig } from "../client";
import { AssetTableInsert, AssetTableRow, AssetTableUpdate } from "../types";

export class SupabaseAssetRepository {
  private config?: SupabaseConfig;
  private client?: SupabaseClient;
  private hasLoggedMigrationHint: boolean = false;

  constructor(options?: { config?: SupabaseConfig; client?: SupabaseClient }) {
    this.config = options?.config;
    this.client = options?.client;
  }

  private getClient(): SupabaseClient | null {
    if (this.client) {
      return this.client;
    }

    // Server-side environment: If service role key is present, use privileged admin client to bypass RLS
    if (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        return getSupabaseAdminClient();
      } catch {
        // Fallback to standard credentials
      }
    }

    return getSupabaseClient(this.config);
  }

  public mapRowToAsset(row: AssetTableRow): Asset {
    let categorySlug = row.category_slug || undefined;
    let subcategorySlug = row.subcategory_slug || undefined;
    const subcategoryId = row.subcategory_id || undefined;
    const subcategoryName = row.subcategory_name || undefined;

    // Check tags for taxonomy tags if not explicitly present
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        if (!categorySlug && tag.startsWith("cat:")) {
          categorySlug = tag.replace("cat:", "");
        }
        if (!subcategorySlug && tag.startsWith("subcat:")) {
          subcategorySlug = tag.replace("subcat:", "");
        }
      }
    }

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      categorySlug: categorySlug || (row.category ? row.category.toLowerCase().replace(/\s+/g, "-") : undefined),
      subcategoryId,
      subcategorySlug,
      subcategoryName,
      status: row.status || "published",
      contentHash: row.content_hash || undefined,
      version: row.version || 1,
      createdBy: row.created_by || undefined,
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

  public async list(options?: {
    category?: string;
    categorySlug?: string;
    subcategory?: string;
    subcategorySlug?: string;
    search?: string;
    status?: "published" | "draft" | "archived" | "all";
  }): Promise<Asset[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }

    try {
      let query = client.from("assets").select("*").order("created_at", { ascending: false });

      // Enforce status filtering: default to 'published' (or null for legacy rows) for customer safety
      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      } else if (!options?.status) {
        query = query.or("status.eq.published,status.is.null");
      }

      const catFilter = options?.categorySlug || options?.category;
      if (catFilter && catFilter !== "all") {
        query = query.or(
          `category_slug.eq.${catFilter},category.eq.${catFilter},category.ilike.%${catFilter}%,tags.cs.{cat:${catFilter}},tags.cs.{${catFilter}}`
        );
      }

      const subcatFilter = options?.subcategorySlug || options?.subcategory;
      if (subcatFilter && subcatFilter !== "all") {
        query = query.or(
          `subcategory_slug.eq.${subcatFilter},subcategory_id.eq.${subcatFilter},tags.cs.{subcat:${subcatFilter}},tags.cs.{${subcatFilter}}`
        );
      }

      if (options?.search && options.search.trim()) {
        const term = options.search.trim();
        query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%,subcategory_name.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback query if status column does not exist yet on live DB
        if (error.message.includes("column") && error.message.includes("status")) {
          const fallbackRes = await client.from("assets").select("*").order("created_at", { ascending: false });
          if (fallbackRes.data) {
            return (fallbackRes.data as AssetTableRow[]).map((r) => this.mapRowToAsset(r));
          }
        }
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
    const client = this.getClient();
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

  public async getByHash(contentHash: string): Promise<Asset | null> {
    const client = this.getClient();
    if (!client || !contentHash) return null;

    try {
      const { data, error } = await client
        .from("assets")
        .select("*")
        .eq("content_hash", contentHash)
        .maybeSingle();

      if (error) return null;
      return data ? this.mapRowToAsset(data as AssetTableRow) : null;
    } catch {
      return null;
    }
  }

  public async isAssetReferencedInDesigns(
    assetId: string,
    assetUrl?: string
  ): Promise<{ referenced: boolean; designCount: number; designNames: string[] }> {
    const client = this.getClient();
    if (!client) {
      return { referenced: false, designCount: 0, designNames: [] };
    }

    try {
      const { data, error } = await client
        .from("designs")
        .select("id, name, pages")
        .limit(100);

      if (error || !data) {
        return { referenced: false, designCount: 0, designNames: [] };
      }

      const matchingDesigns: string[] = [];
      const searchTerms = [assetId];
      if (assetUrl) searchTerms.push(assetUrl);

      for (const design of data) {
        const pagesStr = JSON.stringify(design.pages || []);
        const isMatch = searchTerms.some((term) => term && pagesStr.includes(term));
        if (isMatch) {
          matchingDesigns.push(design.name || design.id);
        }
      }

      return {
        referenced: matchingDesigns.length > 0,
        designCount: matchingDesigns.length,
        designNames: matchingDesigns.slice(0, 5),
      };
    } catch {
      return { referenced: false, designCount: 0, designNames: [] };
    }
  }

  public async create(input: AssetTableInsert): Promise<Asset> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const payload: Record<string, unknown> = {
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
    };

    if (input.category_slug) payload.category_slug = input.category_slug;
    if (input.subcategory_id) payload.subcategory_id = input.subcategory_id;
    if (input.subcategory_slug) payload.subcategory_slug = input.subcategory_slug;
    if (input.subcategory_name) payload.subcategory_name = input.subcategory_name;
    if (input.status) payload.status = input.status;
    if (input.content_hash) payload.content_hash = input.content_hash;
    if (input.version !== undefined && input.version !== null) payload.version = input.version;
    if (input.created_by) payload.created_by = input.created_by;

    let res = await client
      .from("assets")
      .insert(payload)
      .select()
      .single();

    // Fallback if specific taxonomy or lifecycle columns don't exist yet on database table
    if (res.error && (res.error.message.includes("column") || res.error.message.includes("does not exist"))) {
      delete payload.category_slug;
      delete payload.subcategory_id;
      delete payload.subcategory_slug;
      delete payload.subcategory_name;
      delete payload.status;
      delete payload.content_hash;
      delete payload.version;
      delete payload.created_by;
      res = await client
        .from("assets")
        .insert(payload)
        .select()
        .single();
    }

    if (res.error) {
      this.handleMissingTable(res.error, "create");
      const isMissingTable =
        res.error.message.includes("PGRST205") ||
        res.error.message.includes("Could not find the table") ||
        res.error.message.includes('relation "public.assets" does not exist');
      if (isMissingTable) {
        throw new Error(
          "Supabase table 'public.assets' has not been created yet. Please execute 'infrastructure/supabase/migrations/002_create_assets_table.sql' in your Supabase SQL Editor."
        );
      }
      if (
        res.error.message.includes("row-level security") ||
        res.error.message.includes("violates row-level security policy")
      ) {
        throw new Error(
          `Failed to create asset in Supabase: new row violates row-level security policy for table "assets". ` +
          `To fix this: ` +
          `1) Add SUPABASE_SERVICE_ROLE_KEY to your .env file so backend API endpoints can bypass RLS, OR ` +
          `2) Run 'infrastructure/supabase/migrations/010_fix_assets_rls_policy.sql' in your Supabase SQL Editor.`
        );
      }
      throw new Error(`Failed to create asset in Supabase: ${res.error.message}`);
    }

    return this.mapRowToAsset(res.data as AssetTableRow);
  }

  public async update(id: string, updates: AssetTableUpdate): Promise<Asset> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const payload: Record<string, unknown> = { ...updates };

    let res = await client
      .from("assets")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    // Fallback if specific lifecycle columns don't exist yet on database table
    if (res.error && (res.error.message.includes("column") || res.error.message.includes("does not exist"))) {
      delete payload.status;
      delete payload.content_hash;
      delete payload.version;
      delete payload.created_by;
      res = await client
        .from("assets")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
    }

    if (res.error) {
      throw new Error(`Failed to update asset in Supabase: ${res.error.message}`);
    }

    return this.mapRowToAsset(res.data as AssetTableRow);
  }

  public async replace(
    id: string,
    input: {
      r2Key: string;
      publicUrl: string;
      contentType?: string;
      sizeBytes?: number;
      contentHash?: string;
      svgContent?: string | null;
      name?: string;
    }
  ): Promise<Asset> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Asset with id '${id}' not found`);
    }

    const newVersion = (existing.version || 1) + 1;
    const updates: AssetTableUpdate = {
      r2_key: input.r2Key,
      public_url: input.publicUrl,
      content_type: input.contentType || existing.contentType,
      size_bytes: input.sizeBytes !== undefined ? input.sizeBytes : existing.sizeBytes,
      version: newVersion,
      svg_content: input.svgContent !== undefined ? input.svgContent : existing.source,
      thumbnail_url: input.publicUrl,
      updated_at: new Date().toISOString(),
    };

    if (input.contentHash) updates.content_hash = input.contentHash;
    if (input.name) updates.name = input.name;

    return this.update(id, updates);
  }

  public async delete(id: string): Promise<AssetTableRow | null> {
    const client = this.getClient();
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
    const client = this.getClient();
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
