import { Page } from "@design-platform/types";

export interface DesignTableRow {
  id: string;
  workspace_id?: string | null;
  name: string;
  width: number;
  height: number;
  background_color: string;
  pages: Page[];
  thumbnail: string | null;
  favorite: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type DesignTableInsert = Omit<DesignTableRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type DesignTableUpdate = Partial<Omit<DesignTableRow, "id" | "created_at">>;

export interface AssetTableRow {
  id: string;
  name: string;
  category: string;
  category_slug?: string | null;
  subcategory_id?: string | null;
  subcategory_slug?: string | null;
  subcategory_name?: string | null;
  type: string;
  r2_key: string;
  public_url: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  tags: string[];
  svg_content: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetTableInsert = Omit<AssetTableRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type AssetTableUpdate = Partial<Omit<AssetTableRow, "id" | "created_at">>;

export interface ProfileTableRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileTableInsert = Omit<ProfileTableRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type ProfileTableUpdate = Partial<Omit<ProfileTableRow, "id" | "created_at">>;

export interface WorkspaceTableRow {
  id: string;
  name: string;
  slug: string | null;
  type: "personal" | "team";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceTableInsert = Omit<WorkspaceTableRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type WorkspaceTableUpdate = Partial<Omit<WorkspaceTableRow, "id" | "created_at" | "created_by">>;

export interface WorkspaceMemberTableRow {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: string;
  updated_at: string;
}

export type WorkspaceMemberTableInsert = Omit<WorkspaceMemberTableRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
};

export type WorkspaceMemberTableUpdate = Partial<Omit<WorkspaceMemberTableRow, "workspace_id" | "user_id" | "created_at">>;

export interface WorkspaceInvitationTableRow {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  invited_by: string;
  token_hash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export type WorkspaceInvitationTableInsert = Omit<WorkspaceInvitationTableRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  status?: "pending" | "accepted" | "revoked" | "expired";
  expires_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type WorkspaceInvitationTableUpdate = Partial<Omit<WorkspaceInvitationTableRow, "id" | "workspace_id" | "created_at">>;

export interface DesignShareLinkTableRow {
  id: string;
  design_id: string;
  token: string;
  token_hash: string;
  permission: "view" | "edit";
  is_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export type DesignShareLinkTableInsert = Omit<DesignShareLinkTableRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type DesignShareLinkTableUpdate = Partial<Omit<DesignShareLinkTableRow, "id" | "design_id" | "created_at">>;



