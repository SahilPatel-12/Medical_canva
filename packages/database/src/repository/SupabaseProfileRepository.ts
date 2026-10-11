import { UserProfile } from "@design-platform/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, SupabaseConfig } from "../client";
import { ProfileTableInsert, ProfileTableRow, ProfileTableUpdate } from "../types";

export class SupabaseProfileRepository {
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

  public mapRowToProfile(row: ProfileTableRow): UserProfile {
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public async getById(userId: string): Promise<UserProfile | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn(`[SupabaseProfileRepository] Error fetching profile for ${userId}:`, error.message);
        return null;
      }

      return data ? this.mapRowToProfile(data as ProfileTableRow) : null;
    } catch (err) {
      console.warn(`[SupabaseProfileRepository] Exception fetching profile:`, (err as Error)?.message || err);
      return null;
    }
  }

  public async create(input: ProfileTableInsert): Promise<UserProfile> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data, error } = await client
      .from("profiles")
      .insert({
        id: input.id,
        display_name: input.display_name || null,
        avatar_url: input.avatar_url || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return this.mapRowToProfile(data as ProfileTableRow);
  }

  public async update(userId: string, updates: ProfileTableUpdate): Promise<UserProfile> {
    const client = this.getClient();
    if (!client) {
      throw new Error("Supabase client is not configured");
    }

    const { data, error } = await client
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return this.mapRowToProfile(data as ProfileTableRow);
  }

  public async getOrCreateProfile(user: {
    id: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<UserProfile> {
    const existing = await this.getById(user.id);
    if (existing) return existing;

    const fallbackName = user.displayName ?? (user.email ? user.email.split("@")[0] : "User") ?? null;

    try {
      return await this.create({
        id: user.id,
        display_name: fallbackName,
        avatar_url: user.avatarUrl ?? null,
      });
    } catch {
      // If concurrent insert occurred, fetch again
      const retry = await this.getById(user.id);
      if (retry) return retry;
      return {
        id: user.id,
        displayName: fallbackName,
        avatarUrl: user.avatarUrl ?? null,
      };
    }
  }
}
