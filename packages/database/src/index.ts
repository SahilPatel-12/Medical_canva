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
export const DATABASE_PACKAGE_VERSION = "0.1.0";
