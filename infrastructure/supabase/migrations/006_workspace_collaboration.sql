-- ==============================================================================
-- Migration: 006_workspace_collaboration.sql
-- Description: Workspace Invitations, Role Enforcement & Security Hardening
--              - Creates public.workspace_invitations with hashed tokens
--              - Hardens public.designs RLS to prevent viewers from writing
--              - Adds transactional functions for invite creation, revocation,
--                acceptance, role management, and owner protection.
-- ==============================================================================

-- 1. Helper Function: Check Workspace Role (avoiding recursion)
CREATE OR REPLACE FUNCTION public.has_workspace_role(
  ws_id uuid,
  u_id uuid,
  allowed_roles text[]
)
RETURNS boolean AS $$
BEGIN
  IF ws_id IS NULL OR u_id IS NULL OR allowed_roles IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = u_id
      AND role = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, text[]) TO authenticated, service_role;

-- 2. Helper Function: Get Workspace Role
CREATE OR REPLACE FUNCTION public.get_workspace_role(
  ws_id uuid,
  u_id uuid
)
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  IF ws_id IS NULL OR u_id IS NULL THEN
    RETURN null;
  END IF;

  SELECT role INTO v_role
  FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = u_id;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_workspace_role(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(uuid, uuid) TO authenticated, service_role;

-- 3. Token Hashing Helper Function (SHA-256 via pgcrypto)
CREATE OR REPLACE FUNCTION public.hash_invitation_token(raw_token text)
RETURNS text AS $$
BEGIN
  IF raw_token IS NULL OR length(trim(raw_token)) = 0 THEN
    RETURN null;
  END IF;
  RETURN encode(extensions.digest(raw_token::bytea, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public, extensions;

REVOKE EXECUTE ON FUNCTION public.hash_invitation_token(text) FROM public;
GRANT EXECUTE ON FUNCTION public.hash_invitation_token(text) TO authenticated, service_role;

-- ==============================================================================
-- 4. Fix Critical Design-Role Authorization Gap on public.designs
-- ==============================================================================
-- Drop all existing policies on designs to ensure no permissive bypass exists
DROP POLICY IF EXISTS "Allow all access to designs for development" ON public.designs;
DROP POLICY IF EXISTS "Allow all operations for development" ON public.designs;
DROP POLICY IF EXISTS "Allow public read access" ON public.designs;
DROP POLICY IF EXISTS "Users can read designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Users can create designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Users can update designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Users can delete designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Editors can create designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Editors can update designs in workspaces they belong to" ON public.designs;
DROP POLICY IF EXISTS "Editors can delete designs in workspaces they belong to" ON public.designs;

-- 4.1 SELECT: Any authorized workspace member (owner, admin, editor, viewer) can read
CREATE POLICY "Users can read designs in workspaces they belong to"
  ON public.designs
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NOT NULL AND
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 4.2 INSERT: Only owners, admins, and editors can create designs (viewers rejected)
CREATE POLICY "Editors can create designs in workspaces they belong to"
  ON public.designs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL AND
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner', 'admin', 'editor'])
  );

-- 4.3 UPDATE: Only owners, admins, and editors can update designs (viewers rejected)
CREATE POLICY "Editors can update designs in workspaces they belong to"
  ON public.designs
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IS NOT NULL AND
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner', 'admin', 'editor'])
  )
  WITH CHECK (
    workspace_id IS NOT NULL AND
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner', 'admin', 'editor'])
  );

-- 4.4 DELETE: Only owners, admins, and editors can delete designs (viewers rejected)
CREATE POLICY "Editors can delete designs in workspaces they belong to"
  ON public.designs
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IS NOT NULL AND
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner', 'admin', 'editor'])
  );

-- ==============================================================================
-- 5. Create 'public.workspace_invitations' Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: At most ONE pending invitation per (workspace_id, normalized email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_unique_pending
  ON public.workspace_invitations (workspace_id, lower(trim(email)))
  WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations (lower(trim(email)));

-- Trigger for invitations.updated_at
DROP TRIGGER IF EXISTS set_workspace_invitations_updated_at ON public.workspace_invitations;
CREATE TRIGGER set_workspace_invitations_updated_at
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on invitations
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- 5.1 SELECT: Only owners and admins can view pending invitations for their workspace
DROP POLICY IF EXISTS "Admins can view workspace invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can view workspace invitations"
  ON public.workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Direct client INSERT, UPDATE, DELETE are forbidden; all mutations occur via SECURITY DEFINER functions.

-- ==============================================================================
-- 6. Transactional Procedures for Invitation & Member Management
-- ==============================================================================

-- 6.1 Create Workspace Invitation
CREATE OR REPLACE FUNCTION public.create_workspace_invitation(
  p_workspace_id uuid,
  p_email text,
  p_role text,
  p_raw_token text
)
RETURNS jsonb AS $$
DECLARE
  v_caller_id uuid;
  v_norm_email text;
  v_token_hash text;
  v_new_inv record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify caller has owner or admin role in workspace
  IF NOT public.has_workspace_role(p_workspace_id, v_caller_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can invite members';
  END IF;

  -- Validate role (cannot invite as owner)
  IF p_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid invitation role. Must be admin, editor, or viewer';
  END IF;

  -- Normalize email
  v_norm_email := lower(trim(p_email));
  IF v_norm_email IS NULL OR position('@' in v_norm_email) < 2 THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  -- Check if user is already an active member of this workspace
  IF EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN auth.users u ON u.id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id AND lower(trim(u.email)) = v_norm_email
  ) THEN
    RAISE EXCEPTION 'User is already a member of this workspace';
  END IF;

  -- Hash token
  v_token_hash := public.hash_invitation_token(p_raw_token);
  IF v_token_hash IS NULL THEN
    RAISE EXCEPTION 'Token cannot be empty';
  END IF;

  -- Insert invitation
  INSERT INTO public.workspace_invitations (
    workspace_id,
    email,
    role,
    invited_by,
    token_hash,
    status,
    expires_at
  )
  VALUES (
    p_workspace_id,
    v_norm_email,
    p_role,
    v_caller_id,
    v_token_hash,
    'pending',
    now() + interval '7 days'
  )
  RETURNING id, workspace_id, email, role, status, expires_at, created_at INTO v_new_inv;

  RETURN jsonb_build_object(
    'id', v_new_inv.id,
    'workspace_id', v_new_inv.workspace_id,
    'email', v_new_inv.email,
    'role', v_new_inv.role,
    'status', v_new_inv.status,
    'expires_at', v_new_inv.expires_at,
    'created_at', v_new_inv.created_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_workspace_invitation(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(uuid, text, text, text) TO authenticated, service_role;

-- 6.2 Revoke Workspace Invitation
CREATE OR REPLACE FUNCTION public.revoke_workspace_invitation(
  p_invitation_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_caller_id uuid;
  v_workspace_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM public.workspace_invitations
  WHERE id = p_invitation_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF NOT public.has_workspace_role(v_workspace_id, v_caller_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can revoke invitations';
  END IF;

  UPDATE public.workspace_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id AND status = 'pending';

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) TO authenticated, service_role;

-- 6.3 Inspect Invitation Details (Safe Public/Invitee Lookup)
CREATE OR REPLACE FUNCTION public.get_invitation_details(
  p_raw_token text
)
RETURNS jsonb AS $$
DECLARE
  v_token_hash text;
  v_inv record;
  v_ws_name text;
  v_is_expired boolean;
BEGIN
  v_token_hash := public.hash_invitation_token(p_raw_token);
  IF v_token_hash IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT i.*, w.name AS ws_name
  INTO v_inv
  FROM public.workspace_invitations i
  JOIN public.workspaces w ON w.id = i.workspace_id
  WHERE i.token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_is_expired := (v_inv.expires_at <= now());
  IF v_is_expired AND v_inv.status = 'pending' THEN
    UPDATE public.workspace_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = v_inv.id;
    v_inv.status := 'expired';
  END IF;

  RETURN jsonb_build_object(
    'id', v_inv.id,
    'workspace_id', v_inv.workspace_id,
    'workspace_name', v_inv.ws_name,
    'email', v_inv.email,
    'role', v_inv.role,
    'status', v_inv.status,
    'expires_at', v_inv.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_invitation_details(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_invitation_details(text) TO authenticated, anon, service_role;

-- 6.4 Accept Workspace Invitation
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
  p_raw_token text
)
RETURNS uuid AS $$
DECLARE
  v_caller_id uuid;
  v_caller_email text;
  v_token_hash text;
  v_inv record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept an invitation';
  END IF;

  -- Look up authenticated user's email
  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = v_caller_id;

  IF v_caller_email IS NULL THEN
    RAISE EXCEPTION 'Caller user account has no associated email';
  END IF;

  v_token_hash := public.hash_invitation_token(p_raw_token);
  IF v_token_hash IS NULL THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  SELECT * INTO v_inv
  FROM public.workspace_invitations
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or invalid';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is % and can no longer be accepted', v_inv.status;
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.workspace_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = v_inv.id;
    RAISE EXCEPTION 'This invitation has expired';
  END IF;

  -- Strictly verify that the authenticated user's email matches the invited email
  IF lower(trim(v_caller_email)) <> lower(trim(v_inv.email)) THEN
    RAISE EXCEPTION 'This invitation was sent to %, but you are signed in as %', v_inv.email, v_caller_email;
  END IF;

  -- Insert or update membership
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.workspace_id, v_caller_id, v_inv.role)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  -- Mark invitation as accepted
  UPDATE public.workspace_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_inv.id;

  RETURN v_inv.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.accept_workspace_invitation(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated, service_role;

-- 6.5 Update Workspace Member Role
CREATE OR REPLACE FUNCTION public.update_workspace_member_role(
  p_workspace_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS boolean AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_ws_owner_id uuid;
  v_target_current_role text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_new_role NOT IN ('admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, editor, or viewer';
  END IF;

  -- Determine workspace owner
  SELECT created_by INTO v_ws_owner_id
  FROM public.workspaces
  WHERE id = p_workspace_id;

  IF v_ws_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Invariant: Workspace owner can NEVER be demoted or have their role altered
  IF p_target_user_id = v_ws_owner_id THEN
    RAISE EXCEPTION 'Cannot modify the role of the workspace owner';
  END IF;

  -- Determine caller role
  v_caller_role := public.get_workspace_role(p_workspace_id, v_caller_id);
  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners and admins can change member roles';
  END IF;

  -- Check target's current role
  v_target_current_role := public.get_workspace_role(p_workspace_id, p_target_user_id);
  IF v_target_current_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this workspace';
  END IF;

  -- Admin boundaries: Admins cannot promote anyone to owner, nor can they alter an owner or other admin
  IF v_caller_role = 'admin' AND v_target_current_role = 'admin' AND v_caller_id <> p_target_user_id THEN
    RAISE EXCEPTION 'Admins cannot modify the role of other admins; only the owner may do so';
  END IF;

  UPDATE public.workspace_members
  SET role = p_new_role, updated_at = now()
  WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.update_workspace_member_role(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid, uuid, text) TO authenticated, service_role;

-- 6.6 Remove Workspace Member
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id uuid,
  p_target_user_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_ws_owner_id uuid;
  v_target_current_role text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Determine workspace owner
  SELECT created_by INTO v_ws_owner_id
  FROM public.workspaces
  WHERE id = p_workspace_id;

  IF v_ws_owner_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found';
  END IF;

  -- Invariant: Workspace owner can NEVER be removed
  IF p_target_user_id = v_ws_owner_id THEN
    RAISE EXCEPTION 'Cannot remove the workspace owner from the workspace';
  END IF;

  v_caller_role := public.get_workspace_role(p_workspace_id, v_caller_id);
  v_target_current_role := public.get_workspace_role(p_workspace_id, p_target_user_id);

  IF v_target_current_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this workspace';
  END IF;

  -- Either caller is owner/admin removing someone, OR caller is removing themselves (leaving)
  IF v_caller_id = p_target_user_id THEN
    -- Voluntary leave: allowed for non-owners
    DELETE FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;
    RETURN true;
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only workspace owners and admins can remove members';
  END IF;

  -- Admins cannot remove other admins; only owners can
  IF v_caller_role = 'admin' AND v_target_current_role = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot remove other admins; only the owner may do so';
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated, service_role;
