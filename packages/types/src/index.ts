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
  thumbnail?: string;
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
  workspaceId?: string; // Phase 3: Workspace ownership boundary
}

export interface CreateDesignInput {
  name: string;
  width: number;
  height: number;
  backgroundColor?: string;
  pages?: Page[];
  workspaceId?: string; // Phase 3: Target workspace for creation
}

export type AssetCategory = "science" | "shapes" | "icons" | "illustrations" | string;

export interface AssetSubcategoryItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  displayOrder: number;
  iconName?: string;
}

export interface AssetCategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  displayOrder: number;
  iconName?: string;
  subcategories: AssetSubcategoryItem[];
}

export interface Asset {
  id: string;
  name: string;
  type: ElementType;
  category: AssetCategory;
  categorySlug?: string;
  subcategoryId?: string;
  subcategorySlug?: string;
  subcategoryName?: string;
  source: string; // SVG code, shape blueprint, or public URL
  url?: string;
  r2Key?: string;
  contentType?: string;
  sizeBytes?: number;
  thumbnail?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  viewBox?: string;
  tags?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Design Repository Interface
 * Scoped by workspace ownership boundary (Phase 3)
 */
export interface DesignRepository {
  list(workspaceId?: string): Promise<DesignDocument[]>;
  getById(id: string, workspaceId?: string): Promise<DesignDocument | null>;
  create(input: CreateDesignInput): Promise<DesignDocument>;
  update(id: string, updates: Partial<DesignDocument>, workspaceId?: string): Promise<DesignDocument>;
  delete(id: string, workspaceId?: string): Promise<void>;
  duplicate(id: string, workspaceId?: string): Promise<DesignDocument>;
}

/**
 * Application User Profile (maps to public.profiles)
 * Linked 1:1 with auth.users.id
 */
export interface UserProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Workspace Type enum
 */
export type WorkspaceType = "personal" | "team";

/**
 * Workspace Membership Role enum
 */
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

/**
 * Workspace Entity (maps to public.workspaces)
 */
export interface Workspace {
  id: string;
  name: string;
  slug?: string | null;
  type: WorkspaceType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workspace Member Entity (maps to public.workspace_members)
 */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
  user?: UserProfile;
}

/**
 * Workspace composite object with caller's role
 */
export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

/**
 * Workspace Invitation Status
 */
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

/**
 * Workspace Invitation Entity (maps to public.workspace_invitations)
 */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  workspaceName?: string;
  token?: string; // Only present immediately upon creation for sharing
}

export interface CreateInvitationInput {
  workspaceId: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: InvitationStatus;
  expiresAt: string;
}

// ==========================================
// Design Link Sharing & Real-time Collaboration (Phase 4)
// ==========================================

export type SharePermission = "view" | "edit";

export interface DesignShareLink {
  id: string;
  designId: string;
  token: string;
  permission: SharePermission;
  isEnabled: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDesignDetails {
  design: DesignDocument;
  permission: SharePermission;
  shareId: string;
}

export interface UpdateShareLinkInput {
  designId: string;
  isEnabled: boolean;
  permission: SharePermission;
  regenerateToken?: boolean;
}

export interface CollaboratorInfo {
  clientId: string;
  userId?: string | null;
  name: string;
  avatarUrl?: string | null;
  color: string;
  selectedElementId?: string | null;
  isEditing?: boolean;
  lastActive: number;
}
export * from "./sanitize.js";
