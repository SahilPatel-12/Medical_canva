-- ==============================================================================
-- Migration: 004_create_workspaces_table.sql
-- Description: Creates workspaces and workspace_members tables, RLS policies,
--              transactional workspace provisioning functions, trigger update,
--              and existing-user backfill.
-- ==============================================================================

-- 1. Create the 'workspaces' table
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  type text not null default 'personal' check (type in ('personal', 'team')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for workspaces
create index if not exists idx_workspaces_created_by on public.workspaces (created_by);
create index if not exists idx_workspaces_updated_at on public.workspaces (updated_at desc);

-- Unique constraint ensuring each user can have at most ONE personal workspace
create unique index if not exists idx_workspaces_personal_unique
  on public.workspaces (created_by)
  where (type = 'personal');

-- Trigger for workspaces.updated_at
drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row
  execute function public.update_updated_at_column();

-- 2. Create the 'workspace_members' table
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Indexes for workspace_members
create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_workspace_members_role on public.workspace_members (workspace_id, role);

-- Trigger for workspace_members.updated_at
drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
  before update on public.workspace_members
  for each row
  execute function public.update_updated_at_column();

-- 3. Security Definer Helper: is_workspace_member
-- Avoids infinite recursion when evaluating RLS policies on workspace_members and workspaces.
create or replace function public.is_workspace_member(ws_id uuid, u_id uuid)
returns boolean as $$
begin
  if u_id is null or ws_id is null then
    return false;
  end if;
  return exists (
    select 1
    from public.workspace_members
    where workspace_id = ws_id and user_id = u_id
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Revoke public execution and grant to authenticated and service_role
revoke execute on function public.is_workspace_member(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated, service_role;

-- 4. Enable Row Level Security (RLS)
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- 5. RLS Policies for 'workspaces'
-- Members can view their workspaces
drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id, auth.uid()));

-- Only owners and admins can update workspace metadata (name, slug)
drop policy if exists "Owners and admins can update workspace" on public.workspaces;
create policy "Owners and admins can update workspace"
  on public.workspaces
  for update
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

-- Only owners can delete a workspace (and personal workspaces cannot be deleted by clients)
drop policy if exists "Owners can delete non-personal workspace" on public.workspaces;
create policy "Owners can delete non-personal workspace"
  on public.workspaces
  for delete
  to authenticated
  using (
    type <> 'personal' and
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id
        and user_id = auth.uid()
        and role = 'owner'
    )
  );

-- 6. RLS Policies for 'workspace_members'
-- Members can view the member list of workspaces they belong to
drop policy if exists "Members can view workspace memberships" on public.workspace_members;
create policy "Members can view workspace memberships"
  on public.workspace_members
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

-- Direct insert/update/delete on workspace_members by normal clients is prohibited.
-- All membership mutations must occur through trusted functions or server operations.

-- 7. Transactional Provisioning Function for Personal Workspaces
create or replace function public.provision_personal_workspace(
  target_user_id uuid,
  workspace_name text default null
)
returns uuid as $$
declare
  existing_ws_id uuid;
  new_ws_id uuid;
  final_name text;
begin
  if target_user_id is null then
    raise exception 'Target user ID cannot be null';
  end if;

  -- Verify authorization: only self or service_role/trigger
  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Not authorized to provision workspace for another user';
  end if;

  -- 1. Check if user already has a personal workspace (idempotency check)
  select id into existing_ws_id
  from public.workspaces
  where created_by = target_user_id and type = 'personal'
  limit 1;

  if existing_ws_id is not null then
    -- Ensure owner membership exists
    insert into public.workspace_members (workspace_id, user_id, role)
    values (existing_ws_id, target_user_id, 'owner')
    on conflict (workspace_id, user_id) do nothing;

    return existing_ws_id;
  end if;

  -- 2. Determine default workspace name
  final_name := coalesce(nullif(trim(workspace_name), ''), 'Personal Workspace');

  -- 3. Atomic creation of workspace + owner membership
  insert into public.workspaces (name, type, created_by)
  values (final_name, 'personal', target_user_id)
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, target_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new_ws_id;
exception
  when unique_violation then
    -- Handle concurrent creation race condition gracefully
    select id into existing_ws_id
    from public.workspaces
    where created_by = target_user_id and type = 'personal'
    limit 1;

    if existing_ws_id is not null then
      insert into public.workspace_members (workspace_id, user_id, role)
      values (existing_ws_id, target_user_id, 'owner')
      on conflict (workspace_id, user_id) do nothing;
      return existing_ws_id;
    end if;
    raise;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.provision_personal_workspace(uuid, text) from public;
grant execute on function public.provision_personal_workspace(uuid, text) to authenticated, service_role;

-- 8. General Workspace Creation Function (Personal or Team)
create or replace function public.create_workspace(
  name text,
  type text default 'team',
  slug text default null
)
returns uuid as $$
declare
  caller_id uuid;
  new_ws_id uuid;
  clean_name text;
  clean_type text;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required to create a workspace';
  end if;

  clean_name := nullif(trim(name), '');
  if clean_name is null then
    raise exception 'Workspace name cannot be empty';
  end if;

  clean_type := coalesce(nullif(trim(type), ''), 'team');
  if clean_type not in ('personal', 'team') then
    raise exception 'Invalid workspace type. Must be "personal" or "team"';
  end if;

  if clean_type = 'personal' then
    return public.provision_personal_workspace(caller_id, clean_name);
  end if;

  -- Create team workspace
  insert into public.workspaces (name, slug, type, created_by)
  values (clean_name, nullif(trim(slug), ''), 'team', caller_id)
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, caller_id, 'owner');

  return new_ws_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.create_workspace(text, text, text) from public;
grant execute on function public.create_workspace(text, text, text) to authenticated, service_role;

-- 9. Update the Signup Trigger: handle_new_user()
-- Provisions profile and personal workspace atomically upon auth.users insert.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_display_name text;
begin
  -- Resolve display name from metadata or email
  user_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  -- 1. Provision profile
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    user_display_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;

  -- 2. Provision personal workspace atomically
  perform public.provision_personal_workspace(
    new.id,
    case
      when user_display_name is not null and length(trim(user_display_name)) > 0
      then trim(user_display_name) || '''s Workspace'
      else 'Personal Workspace'
    end
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Re-bind trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 10. Existing Users Backfill
-- Iterates over existing auth.users and provisions personal workspaces safely & idempotently.
do $$
declare
  u record;
  user_display_name text;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users
  loop
    user_display_name := coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'display_name',
      split_part(u.email, '@', 1)
    );

    perform public.provision_personal_workspace(
      u.id,
      case
        when user_display_name is not null and length(trim(user_display_name)) > 0
        then trim(user_display_name) || '''s Workspace'
        else 'Personal Workspace'
      end
    );
  end loop;
end;
$$;
