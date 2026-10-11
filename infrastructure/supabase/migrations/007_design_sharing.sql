-- ==============================================================================
-- Migration: 007_design_sharing.sql
-- Description: Canva-Style Link Sharing & Collaboration Access Control
--              - Creates public.design_share_links with hashed tokens
--              - Scopes link permissions ('view' | 'edit')
--              - Provides secure RPCs for managing and resolving share links
--              - Enforces authenticated write permissions for editor-link recipients
-- ==============================================================================

-- 1. Helper Function: Token Hashing (SHA-256 via pgcrypto in extensions schema)
CREATE OR REPLACE FUNCTION public.hash_share_token(raw_token text)
RETURNS text AS $$
BEGIN
  IF raw_token IS NULL OR length(trim(raw_token)) = 0 THEN
    RETURN null;
  END IF;
  RETURN encode(extensions.digest(raw_token::bytea, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.hash_share_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.hash_share_token(text) TO authenticated, anon, service_role;

-- ==============================================================================
-- 2. Create 'public.design_share_links' Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.design_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id text NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  token text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  permission text NOT NULL CHECK (permission IN ('view', 'edit')),
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- At most one share link configuration per design
CREATE UNIQUE INDEX IF NOT EXISTS idx_design_share_links_design_id
  ON public.design_share_links (design_id);

-- High-performance lookup by token hash
CREATE INDEX IF NOT EXISTS idx_design_share_links_token_hash
  ON public.design_share_links (token_hash);

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS set_design_share_links_updated_at ON public.design_share_links;
CREATE TRIGGER set_design_share_links_updated_at
  BEFORE UPDATE ON public.design_share_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.design_share_links ENABLE ROW LEVEL SECURITY;

-- 2.1 SELECT: Only authorized workspace members (owner, admin, editor) of the design's workspace can view the share link row
DROP POLICY IF EXISTS "Workspace editors can view design share links" ON public.design_share_links;
CREATE POLICY "Workspace editors can view design share links"
  ON public.design_share_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.designs d
      WHERE d.id = design_share_links.design_id
        AND d.workspace_id IS NOT NULL
        AND public.has_workspace_role(d.workspace_id, auth.uid(), ARRAY['owner', 'admin', 'editor'])
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.design_share_links TO authenticated, service_role;
GRANT SELECT ON TABLE public.design_share_links TO anon;

-- Direct client INSERT, UPDATE, DELETE are forbidden; all modifications happen through SECURITY DEFINER RPCs.

-- ==============================================================================
-- 3. Transactional Functions for Share Link Management & Resolution
-- ==============================================================================

-- 3.1 Get or Create Design Share Link (Owner / Workspace Editor only)
CREATE OR REPLACE FUNCTION public.get_or_create_design_share_link(
  p_design_id text,
  p_raw_token text DEFAULT null
)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid;
  v_workspace_id uuid;
  v_link record;
  v_raw_token text;
  v_token_hash text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify design existence and retrieve workspace_id
  SELECT workspace_id INTO v_workspace_id
  FROM public.designs
  WHERE id = p_design_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Design not found or access denied';
  END IF;

  -- Verify caller has owner, admin, or editor role in the design workspace
  IF NOT public.has_workspace_role(v_workspace_id, v_caller_id, ARRAY['owner', 'admin', 'editor']) THEN
    RAISE EXCEPTION 'Only workspace editors, admins, and owners can manage share links';
  END IF;

  -- Check if a share link row already exists
  SELECT * INTO v_link
  FROM public.design_share_links
  WHERE design_id = p_design_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_link.id,
      'design_id', v_link.design_id,
      'token', v_link.token,
      'permission', v_link.permission,
      'is_enabled', v_link.is_enabled,
      'expires_at', v_link.expires_at,
      'created_at', v_link.created_at,
      'updated_at', v_link.updated_at
    );
  END IF;

  -- If not found, create disabled link by default
  v_raw_token := COALESCE(p_raw_token, encode(extensions.gen_random_bytes(32), 'hex'));
  v_token_hash := public.hash_share_token(v_raw_token);

  INSERT INTO public.design_share_links (
    design_id,
    token,
    token_hash,
    permission,
    is_enabled,
    created_by
  )
  VALUES (
    p_design_id,
    v_raw_token,
    v_token_hash,
    'view',
    false,
    v_caller_id
  )
  RETURNING * INTO v_link;

  RETURN jsonb_build_object(
    'id', v_link.id,
    'design_id', v_link.design_id,
    'token', v_link.token,
    'permission', v_link.permission,
    'is_enabled', v_link.is_enabled,
    'expires_at', v_link.expires_at,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.get_or_create_design_share_link(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_or_create_design_share_link(text, text) TO authenticated, service_role;

-- 3.2 Update Design Share Link (Toggle Enabled, Change Permission, Rotate Token)
CREATE OR REPLACE FUNCTION public.update_design_share_link(
  p_design_id text,
  p_is_enabled boolean,
  p_permission text,
  p_regenerate_token boolean DEFAULT false,
  p_new_raw_token text DEFAULT null
)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid;
  v_workspace_id uuid;
  v_link record;
  v_new_token text;
  v_new_token_hash text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate permission parameter
  IF p_permission NOT IN ('view', 'edit') THEN
    RAISE EXCEPTION 'Invalid permission level. Must be view or edit';
  END IF;

  -- Verify design existence and caller role
  SELECT workspace_id INTO v_workspace_id
  FROM public.designs
  WHERE id = p_design_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Design not found or access denied';
  END IF;

  IF NOT public.has_workspace_role(v_workspace_id, v_caller_id, ARRAY['owner', 'admin', 'editor']) THEN
    RAISE EXCEPTION 'Only workspace editors, admins, and owners can update share links';
  END IF;

  -- If rotating token
  IF p_regenerate_token THEN
    v_new_token := COALESCE(p_new_raw_token, encode(extensions.gen_random_bytes(32), 'hex'));
    v_new_token_hash := public.hash_share_token(v_new_token);

    UPDATE public.design_share_links
    SET
      token = v_new_token,
      token_hash = v_new_token_hash,
      is_enabled = p_is_enabled,
      permission = p_permission,
      updated_at = now()
    WHERE design_id = p_design_id
    RETURNING * INTO v_link;
  ELSE
    UPDATE public.design_share_links
    SET
      is_enabled = p_is_enabled,
      permission = p_permission,
      updated_at = now()
    WHERE design_id = p_design_id
    RETURNING * INTO v_link;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share link configuration not found for this design';
  END IF;

  RETURN jsonb_build_object(
    'id', v_link.id,
    'design_id', v_link.design_id,
    'token', v_link.token,
    'permission', v_link.permission,
    'is_enabled', v_link.is_enabled,
    'expires_at', v_link.expires_at,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.update_design_share_link(text, boolean, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_design_share_link(text, boolean, text, boolean, text) TO authenticated, service_role;

-- 3.3 Safe Token Resolution (Accessible anonymously or authenticated)
-- Returns ONLY necessary design presentation data; never leaks workspace IDs or private information
CREATE OR REPLACE FUNCTION public.get_shared_design_by_token(
  p_raw_token text
)
RETURNS jsonb AS $$
DECLARE
  v_token_hash text;
  v_link record;
  v_design record;
BEGIN
  IF p_raw_token IS NULL OR length(trim(p_raw_token)) = 0 THEN
    RETURN null;
  END IF;

  v_token_hash := public.hash_share_token(p_raw_token);
  IF v_token_hash IS NULL THEN
    RETURN null;
  END IF;

  SELECT * INTO v_link
  FROM public.design_share_links
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN null;
  END IF;

  -- Enforce link must be enabled
  IF NOT v_link.is_enabled THEN
    RETURN null;
  END IF;

  -- Enforce expiration if set
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN null;
  END IF;

  -- Retrieve design data without workspace or internal fields
  SELECT
    id,
    name,
    width,
    height,
    background_color,
    pages,
    thumbnail,
    description,
    created_at,
    updated_at
  INTO v_design
  FROM public.designs
  WHERE id = v_link.design_id;

  IF NOT FOUND THEN
    RETURN null;
  END IF;

  RETURN jsonb_build_object(
    'design', jsonb_build_object(
      'id', v_design.id,
      'name', v_design.name,
      'width', v_design.width,
      'height', v_design.height,
      'backgroundColor', v_design.background_color,
      'pages', v_design.pages,
      'thumbnail', v_design.thumbnail,
      'description', v_design.description,
      'createdAt', v_design.created_at,
      'updatedAt', v_design.updated_at
    ),
    'permission', v_link.permission,
    'share_id', v_link.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.get_shared_design_by_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_design_by_token(text) TO authenticated, anon, service_role;

-- 3.4 Authenticated Shared Design Content Update (For Editor-Link Recipients)
CREATE OR REPLACE FUNCTION public.update_shared_design_content(
  p_design_id text,
  p_raw_token text,
  p_pages jsonb,
  p_thumbnail text DEFAULT null
)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid;
  v_token_hash text;
  v_link record;
  v_design record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to edit a shared design';
  END IF;

  IF p_raw_token IS NULL OR length(trim(p_raw_token)) = 0 THEN
    RAISE EXCEPTION 'Valid share token required';
  END IF;

  v_token_hash := public.hash_share_token(p_raw_token);
  IF v_token_hash IS NULL THEN
    RAISE EXCEPTION 'Invalid share token';
  END IF;

  -- Validate share link
  SELECT * INTO v_link
  FROM public.design_share_links
  WHERE design_id = p_design_id AND token_hash = v_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share link not found or invalid for this design';
  END IF;

  IF NOT v_link.is_enabled THEN
    RAISE EXCEPTION 'Link sharing has been disabled for this design';
  END IF;

  IF v_link.permission <> 'edit' THEN
    RAISE EXCEPTION 'Share link only grants viewing permissions; editing is forbidden';
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RAISE EXCEPTION 'Share link has expired';
  END IF;

  -- Update design pages and thumbnail (does not alter ownership, workspace, or settings)
  UPDATE public.designs
  SET
    pages = COALESCE(p_pages, pages),
    thumbnail = COALESCE(p_thumbnail, thumbnail),
    updated_at = now()
  WHERE id = p_design_id
  RETURNING
    id,
    name,
    width,
    height,
    background_color,
    pages,
    thumbnail,
    description,
    created_at,
    updated_at
  INTO v_design;

  RETURN jsonb_build_object(
    'id', v_design.id,
    'name', v_design.name,
    'width', v_design.width,
    'height', v_design.height,
    'backgroundColor', v_design.background_color,
    'pages', v_design.pages,
    'thumbnail', v_design.thumbnail,
    'description', v_design.description,
    'createdAt', v_design.created_at,
    'updatedAt', v_design.updated_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.update_shared_design_content(text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_shared_design_content(text, text, jsonb, text) TO authenticated, service_role;
