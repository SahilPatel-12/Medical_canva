-- ==============================================================================
-- Medical Canva / Visual Design Platform
-- Migration: 009_production_asset_management.sql
-- Description: Adds canonical taxonomy, lifecycle states (published, draft, archived),
--              content hash, versioning, backfill, and least-privilege RLS policies.
-- ==============================================================================

-- 1. Idempotently add missing columns
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS category_slug text,
  ADD COLUMN IF NOT EXISTS subcategory_id text,
  ADD COLUMN IF NOT EXISTS subcategory_slug text,
  ADD COLUMN IF NOT EXISTS subcategory_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by text;

-- Add check constraint for lifecycle status if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_status_check
      CHECK (status IN ('published', 'draft', 'archived'));
  END IF;
END $$;

-- 2. Indexes for taxonomy, status, content hash, and version
CREATE INDEX IF NOT EXISTS idx_assets_category_slug ON public.assets (category_slug);
CREATE INDEX IF NOT EXISTS idx_assets_subcategory_slug ON public.assets (subcategory_slug);
CREATE INDEX IF NOT EXISTS idx_assets_subcategory_id ON public.assets (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets (status);
CREATE INDEX IF NOT EXISTS idx_assets_content_hash ON public.assets (content_hash);
CREATE INDEX IF NOT EXISTS idx_assets_version ON public.assets (version);

-- 3. Backfill Taxonomy & Status for existing assets
-- 3a. Generic tag-based backfills (where cat: and subcat: tags exist)
UPDATE public.assets a
SET category_slug = sub.slug
FROM (
  SELECT DISTINCT ON (id) id, regexp_replace(t, '^cat:', '') AS slug
  FROM public.assets, unnest(tags) AS t
  WHERE t LIKE 'cat:%'
) sub
WHERE a.id = sub.id AND (a.category_slug IS NULL OR a.category_slug = '');

UPDATE public.assets a
SET subcategory_slug = sub.slug
FROM (
  SELECT DISTINCT ON (id) id, regexp_replace(t, '^subcat:', '') AS slug
  FROM public.assets, unnest(tags) AS t
  WHERE t LIKE 'subcat:%'
) sub
WHERE a.id = sub.id AND (a.subcategory_slug IS NULL OR a.subcategory_slug = '');

-- 3b. Backfill canonical taxonomy mappings for existing built-in illustrations
UPDATE public.assets
SET
  category_slug = 'nucleic-acids',
  subcategory_id = 'sub-dna',
  subcategory_slug = 'dna',
  subcategory_name = 'DNA',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-dna';

UPDATE public.assets
SET
  category_slug = 'cell-types',
  subcategory_id = 'sub-generic-cells',
  subcategory_slug = 'generic-cells',
  subcategory_name = 'Generic Cells',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-cell';

UPDATE public.assets
SET
  category_slug = 'labware-experiments',
  subcategory_id = 'sub-glassware-containers',
  subcategory_slug = 'glassware-containers',
  subcategory_name = 'Glassware & Containers',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-flask';

UPDATE public.assets
SET
  category_slug = 'labware-experiments',
  subcategory_id = 'sub-optics-microscopes',
  subcategory_slug = 'optics-microscopes',
  subcategory_name = 'Optics & Microscopes',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-microscope';

UPDATE public.assets
SET
  category_slug = 'microbiology-virology',
  subcategory_id = 'sub-viruses-pathogens',
  subcategory_slug = 'viruses-pathogens',
  subcategory_name = 'Viruses & Pathogens',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-virus';

UPDATE public.assets
SET
  category_slug = 'chemistry-molecules',
  subcategory_id = 'sub-organic-molecules',
  subcategory_slug = 'organic-molecules',
  subcategory_name = 'Organic Molecules',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-molecule';

UPDATE public.assets
SET
  category_slug = 'medical-clinical',
  subcategory_id = 'sub-medical-symbols',
  subcategory_slug = 'medical-symbols',
  subcategory_name = 'Medical Symbols',
  status = 'published',
  version = 1
WHERE id = 'asset-bio-cross';

UPDATE public.assets
SET
  category_slug = 'shapes-canvas',
  subcategory_id = 'sub-geometric-shapes',
  subcategory_slug = 'geometric-shapes',
  subcategory_name = 'Geometric Shapes',
  status = 'published',
  version = 1
WHERE id IN ('asset-shape-rect', 'asset-shape-circle', 'asset-shape-arrow-r', 'asset-shape-star');

UPDATE public.assets
SET
  category_slug = 'scientific-infographics',
  subcategory_id = 'sub-charts-symbols',
  subcategory_slug = 'charts-symbols',
  subcategory_name = 'Charts & Symbols',
  status = 'published',
  version = 1
WHERE id IN ('asset-icon-target', 'asset-icon-chart', 'asset-icon-idea');

UPDATE public.assets
SET
  category_slug = 'labware-experiments',
  subcategory_id = 'sub-lab-equipment',
  subcategory_slug = 'lab-equipment',
  subcategory_name = 'Lab Equipment',
  status = 'published',
  version = 1
WHERE id = 'asset-1791480100786-sde55';

-- Fallback for any assets where category_slug is still null
UPDATE public.assets
SET category_slug = CASE
  WHEN category = 'science' THEN 'cell-types'
  WHEN category = 'shapes' THEN 'shapes-canvas'
  WHEN category = 'icons' THEN 'scientific-infographics'
  ELSE lower(replace(category, ' ', '-'))
END
WHERE category_slug IS NULL OR category_slug = '';

-- For any remaining rows with null status or version, set defaults safely
UPDATE public.assets
SET status = 'published'
WHERE status IS NULL;

UPDATE public.assets
SET version = 1
WHERE version IS NULL;

-- 4. Least-Privilege Row Level Security (RLS) Policies
-- Ensure RLS is active on public.assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Remove unrestricted development policy if present
DROP POLICY IF EXISTS "Allow all access to assets for development" ON public.assets;

-- Customer-facing safe read access: Only published assets may be selected by public/anonymous callers
DROP POLICY IF EXISTS "Allow public read of published assets" ON public.assets;
CREATE POLICY "Allow public read of published assets"
  ON public.assets
  FOR SELECT
  TO public
  USING (status = 'published');

-- Administrator write access: Insert, update, delete only permitted for authenticated administrators
-- (Note: Supabase service_role key automatically bypasses RLS on backend endpoints)
DROP POLICY IF EXISTS "Allow admin write access to assets" ON public.assets;
CREATE POLICY "Allow admin write access to assets"
  ON public.assets
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
  );
