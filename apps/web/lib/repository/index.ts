import { DesignRepository } from "@design-platform/types";
import { SupabaseDesignRepository, isSupabaseConfigured } from "@design-platform/database";
import { LocalDesignRepository } from "./LocalDesignRepository";

let repositoryInstance: DesignRepository | null = null;

/**
 * Returns the active DesignRepository implementation.
 * Uses SupabaseDesignRepository when Supabase credentials are configured,
 * with graceful automatic fallback to LocalDesignRepository if offline or if
 * the database schema has not been migrated yet.
 */
export function getDesignRepository(): DesignRepository {
  if (!repositoryInstance) {
    const localRepo = new LocalDesignRepository();
    if (isSupabaseConfigured()) {
      repositoryInstance = new SupabaseDesignRepository({
        fallbackRepo: localRepo,
      });
    } else {
      repositoryInstance = localRepo;
    }
  }
  return repositoryInstance;
}

export * from "./LocalDesignRepository";
