-- ==============================================================================
-- Migration: 008_asset_taxonomy_metadata.sql
-- Description: Adds canonical category and subcategory columns to public.assets
-- ==============================================================================

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS category_slug text,
  ADD COLUMN IF NOT EXISTS subcategory_id text,
  ADD COLUMN IF NOT EXISTS subcategory_slug text,
  ADD COLUMN IF NOT EXISTS subcategory_name text;

CREATE INDEX IF NOT EXISTS idx_assets_category_slug ON public.assets (category_slug);
CREATE INDEX IF NOT EXISTS idx_assets_subcategory_slug ON public.assets (subcategory_slug);
