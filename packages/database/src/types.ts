import { Page } from "@design-platform/types";

export interface DesignTableRow {
  id: string;
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
