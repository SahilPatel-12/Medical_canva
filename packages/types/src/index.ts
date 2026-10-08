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

// ==========================================
// Design Platform Domain Models (Phase 1)
// ==========================================

export type ElementType = "svg" | "shape" | "text" | "image";

export type ShapeType = "rectangle" | "circle" | "line";

export interface ShapeProperties {
  shapeType: ShapeType;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface TextProperties {
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align?: "left" | "center" | "right";
  fontWeight?: "normal" | "bold" | "600" | "500";
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
}

export interface SvgProperties {
  svgContent: string;
  originalSvg: string;
  fill?: string;
  stroke?: string;
  preserveAspectRatio?: boolean;
}

export interface ImageProperties {
  src: string;
  originalSrc?: string;
  crossOrigin?: string;
}

export type ElementProperties =
  | ShapeProperties
  | TextProperties
  | SvgProperties
  | ImageProperties
  | Record<string, unknown>;

export interface DesignElement {
  id: string;
  type: ElementType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  opacity: number; // 0 to 1
  locked?: boolean;
  visible?: boolean;
  properties: ElementProperties;
}

export interface Page {
  id: string;
  name?: string;
  elements: DesignElement[];
}

export interface DesignDocument extends BaseEntity {
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  pages: Page[];
  thumbnail?: string; // Data URL preview for instant rendering in My Files
  favorite?: boolean;
  description?: string;
}

export interface CreateDesignInput {
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  pages?: Page[];
}

export type AssetCategory = "science" | "shapes" | "icons" | "illustrations" | string;

export interface Asset {
  id: string;
  name: string;
  type: ElementType;
  category: AssetCategory;
  source: string; // SVG code, shape blueprint, or public URL
  url?: string;
  r2Key?: string;
  contentType?: string;
  sizeBytes?: number;
  thumbnail?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Design Repository Interface
 * Allows clean substitution between LocalStorage, Memory, and Future REST/GraphQL API
 */
export interface DesignRepository {
  list(): Promise<DesignDocument[]>;
  getById(id: string): Promise<DesignDocument | null>;
  create(input: CreateDesignInput): Promise<DesignDocument>;
  update(id: string, updates: Partial<DesignDocument>): Promise<DesignDocument>;
  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<DesignDocument>;
}
