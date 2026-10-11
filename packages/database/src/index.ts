export * from "./types.js";
export * from "./client.js";
export * from "./repository/SupabaseDesignRepository.js";
export * from "./repository/SupabaseAssetRepository.js";
export * from "./repository/SupabaseProfileRepository.js";
export * from "./repository/SupabaseWorkspaceRepository.js";
export * from "./repository/SupabaseShareRepository.js";

/**
 * Database connection configuration placeholder
 */
export interface DatabaseConnectionOptions {
  connectionString: string;
  maxConnections?: number;
  ssl?: boolean;
}

/**
 * Health check status for database layer
 */
export interface DatabaseHealthStatus {
  connected: boolean;
  latencyMs?: number;
  poolSize?: number;
}

/**
 * Version info for database package
 */
export const DATABASE_PACKAGE_VERSION = "0.2.0";
