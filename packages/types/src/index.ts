/**
 * Base generic API Response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: PaginationMeta;
}

/**
 * Standard pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Basic entity fields common across all domain records
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Generic health response type
 */
export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}

/**
 * Environment runtime definition
 */
export type Environment = "development" | "test" | "staging" | "production";
