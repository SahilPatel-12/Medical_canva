import { DesignRepository } from "@design-platform/types";
import { SupabaseDesignRepository, isSupabaseConfigured, type SupabaseClient } from "@design-platform/database";
import { getBrowserSupabaseClient } from "@design-platform/auth";
import { LocalDesignRepository } from "./LocalDesignRepository";

export interface DesignRepositoryOptions {
  workspaceId?: string;
  userId?: string;
  client?: SupabaseClient;
}

let repositoryInstance: DesignRepository | null = null;
let currentScopeKey: string | null = null;

/**
 * Returns the active DesignRepository implementation scoped to the active workspace and user.
 * Automatically re-instantiates when the active user or workspace changes to ensure data isolation.
 */
export function getDesignRepository(options?: DesignRepositoryOptions): DesignRepository {
  const scopeKey = `${options?.userId || "anon"}_${options?.workspaceId || "none"}`;

  if (!repositoryInstance || currentScopeKey !== scopeKey) {
    currentScopeKey = scopeKey;
    const localRepo = new LocalDesignRepository({
      userId: options?.userId,
      workspaceId: options?.workspaceId,
    });

    if (isSupabaseConfigured()) {
      let client = options?.client;
      if (!client && typeof window !== "undefined") {
        try {
          client = getBrowserSupabaseClient();
        } catch (e) {
          console.warn("[DesignRepository] Could not initialize browser Supabase client:", e);
        }
      }

      repositoryInstance = new SupabaseDesignRepository({
        workspaceId: options?.workspaceId,
        client,
        fallbackRepo: localRepo,
      });
    } else {
      repositoryInstance = localRepo;
    }
  }

  return repositoryInstance;
}

/**
 * Clears the cached repository instance on session changes or logout.
 */
export function resetDesignRepository(): void {
  repositoryInstance = null;
  currentScopeKey = null;
}

export * from "./LocalDesignRepository";
export * from "./SharedDesignRepository";

