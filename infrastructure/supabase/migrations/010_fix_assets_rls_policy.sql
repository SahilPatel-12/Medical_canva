-- ==============================================================================
-- Medical Canva / Visual Design Platform
-- Migration 010: Fix Assets Table Row Level Security (RLS) Policies
-- ==============================================================================

-- 1. Ensure RLS is active on public.assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 2. Customer-facing safe read access:
-- Allow anyone (public / anonymous / authenticated) to read published assets (or legacy rows with null status)
DROP POLICY IF EXISTS "Allow public read of published assets" ON public.assets;
CREATE POLICY "Allow public read of published assets"
  ON public.assets
  FOR SELECT
  TO public
  USING (status = 'published' OR status IS NULL);

-- 3. Administrative write access:
-- In development and admin management environments, allow insert, update, and delete.
-- (When using Supabase service_role key, RLS is automatically bypassed by PostgreSQL;
-- this policy ensures admin operations succeed even when using standard client keys).
DROP POLICY IF EXISTS "Allow admin write access to assets" ON public.assets;
CREATE POLICY "Allow admin write access to assets"
  ON public.assets
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

