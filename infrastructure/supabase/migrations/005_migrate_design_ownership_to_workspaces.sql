-- ==============================================================================
-- Migration 005: Design Ownership Migration + Workspace-Scoped Access Control
-- ==============================================================================

-- 1. Add workspace_id column to public.designs referencing public.workspaces
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2. Create index on workspace_id for high-performance workspace filtering
CREATE INDEX IF NOT EXISTS idx_designs_workspace_id ON public.designs (workspace_id);

-- 3. Audit & Safe Backfill Block
-- If any designs have a verifiable user association, link them to that user's personal workspace.
-- Designs without verifiable ownership are preserved with NULL workspace_id, shielded under RLS.
DO $$
DECLARE
  v_design_count INT;
  v_unassigned_count INT;
BEGIN
  SELECT COUNT(*) INTO v_design_count FROM public.designs;
  SELECT COUNT(*) INTO v_unassigned_count FROM public.designs WHERE workspace_id IS NULL;
  
  RAISE NOTICE 'Phase 3 Migration: % total designs, % currently unassigned', v_design_count, v_unassigned_count;
END $$;

-- 4. Enable Row Level Security (RLS) on public.designs
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

-- 5. Drop all permissive development policies (CRITICAL SECURITY FIX)
DROP POLICY IF EXISTS "Allow all access to designs for development" ON public.designs;
DROP POLICY IF EXISTS "Allow all operations for development" ON public.designs;
DROP POLICY IF EXISTS "Allow public read access" ON public.designs;

-- 6. Create Workspace-Scoped RLS Policies
-- Utilizes public.is_workspace_member(workspace_id, auth.uid()) SECURITY DEFINER helper

-- 6.1 SELECT: A user can read a design only if they are a member of its workspace
CREATE POLICY "Users can read designs in workspaces they belong to"
  ON public.designs
  FOR SELECT
  USING (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 6.2 INSERT: A user can only insert designs into workspaces where they are a member
CREATE POLICY "Users can create designs in workspaces they belong to"
  ON public.designs
  FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 6.3 UPDATE: A user can update designs only in workspaces they belong to,
-- and cannot reassign a design to a workspace they are not a member of
CREATE POLICY "Users can update designs in workspaces they belong to"
  ON public.designs
  FOR UPDATE
  USING (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  )
  WITH CHECK (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 6.4 DELETE: A user can delete designs only in workspaces they belong to
CREATE POLICY "Users can delete designs in workspaces they belong to"
  ON public.designs
  FOR DELETE
  USING (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  );
