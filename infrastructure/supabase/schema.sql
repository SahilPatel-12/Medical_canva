-- ==============================================================================
-- Medical Canva / Visual Design Platform - Supabase PostgreSQL Schema
-- ==============================================================================

-- 1. Enable required extensions
create extension if not exists "pgcrypto";

-- 2. Create the 'designs' table
create table if not exists public.designs (
  id text primary key default gen_random_uuid()::text,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  width integer not null default 1200,
  height integer not null default 800,
  background_color text not null default '#ffffff',
  pages jsonb not null default '[]'::jsonb,
  thumbnail text,
  favorite boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create indexes for high-speed listing and sorting
create index if not exists idx_designs_workspace_id on public.designs (workspace_id);
create index if not exists idx_designs_updated_at on public.designs (updated_at desc);
create index if not exists idx_designs_favorite on public.designs (favorite) where favorite = true;

-- 4. Enable Row Level Security (RLS)
alter table public.designs enable row level security;

-- 5. Workspace-Scoped RLS Policies (Phase 3)
drop policy if exists "Allow all access to designs for development" on public.designs;
drop policy if exists "Users can read designs in workspaces they belong to" on public.designs;
drop policy if exists "Users can create designs in workspaces they belong to" on public.designs;
drop policy if exists "Users can update designs in workspaces they belong to" on public.designs;
drop policy if exists "Users can delete designs in workspaces they belong to" on public.designs;

create policy "Users can read designs in workspaces they belong to"
  on public.designs
  for select
  using (
    workspace_id is not null and
    public.is_workspace_member(workspace_id, auth.uid())
  );

create policy "Users can create designs in workspaces they belong to"
  on public.designs
  for insert
  with check (
    workspace_id is not null and
    public.is_workspace_member(workspace_id, auth.uid())
  );

create policy "Users can update designs in workspaces they belong to"
  on public.designs
  for update
  using (
    workspace_id is not null and
    public.is_workspace_member(workspace_id, auth.uid())
  )
  with check (
    workspace_id is not null and
    public.is_workspace_member(workspace_id, auth.uid())
  );

create policy "Users can delete designs in workspaces they belong to"
  on public.designs
  for delete
  using (
    workspace_id is not null and
    public.is_workspace_member(workspace_id, auth.uid())
  );

-- 6. Trigger to automatically update updated_at timestamp on row change
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_designs_updated_at on public.designs;
create trigger set_designs_updated_at
  before update on public.designs
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 7. Create the 'assets' table (Cloudflare R2 + Supabase metadata)
-- ==============================================================================
create table if not exists public.assets (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text not null default 'science',
  type text not null default 'svg',
  r2_key text not null,
  public_url text not null,
  content_type text not null default 'image/svg+xml',
  size_bytes bigint not null default 0,
  width integer not null default 120,
  height integer not null default 120,
  tags text[] not null default '{}'::text[],
  svg_content text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Indexes for assets
create index if not exists idx_assets_category on public.assets (category);
create index if not exists idx_assets_type on public.assets (type);
create index if not exists idx_assets_created_at on public.assets (created_at desc);
create index if not exists idx_assets_r2_key on public.assets (r2_key);

-- 9. Assets Row Level Security (RLS)
alter table public.assets enable row level security;

drop policy if exists "Allow all access to assets for development" on public.assets;
create policy "Allow all access to assets for development"
  on public.assets
  for all
  using (true)
  with check (true);

drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at
  before update on public.assets
  for each row
  execute function public.update_updated_at_column();

-- ==============================================================================
-- 10. Initial Seed: Register the Cloudflare R2 built-in assets
-- ==============================================================================
insert into public.assets (id, name, category, type, r2_key, public_url, content_type, width, height, tags)
values
  ('asset-bio-dna', 'DNA Double Helix', 'science', 'svg', 'assets/science/dna-double-helix.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/dna-double-helix.svg', 'image/svg+xml', 140, 140, array['dna', 'genetics', 'helix', 'biology', 'molecule']),
  ('asset-bio-cell', 'Cell with Nucleus', 'science', 'svg', 'assets/science/cell-with-nucleus.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/cell-with-nucleus.svg', 'image/svg+xml', 150, 150, array['cell', 'biology', 'membrane', 'nucleus', 'organelle']),
  ('asset-bio-flask', 'Erlenmeyer Flask', 'science', 'svg', 'assets/science/erlenmeyer-flask.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/erlenmeyer-flask.svg', 'image/svg+xml', 130, 150, array['flask', 'beaker', 'lab', 'chemistry', 'experiment']),
  ('asset-bio-microscope', 'Microscope', 'science', 'svg', 'assets/science/microscope.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/microscope.svg', 'image/svg+xml', 140, 160, array['microscope', 'optics', 'lab', 'science', 'research']),
  ('asset-bio-virus', 'Virus / Pathogen', 'science', 'svg', 'assets/science/virus-pathogen.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/virus-pathogen.svg', 'image/svg+xml', 130, 130, array['virus', 'pathogen', 'bacteria', 'infection', 'corona']),
  ('asset-bio-molecule', 'Chemical Molecule', 'science', 'svg', 'assets/science/chemical-molecule.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/chemical-molecule.svg', 'image/svg+xml', 140, 140, array['molecule', 'chemical', 'benzene', 'structure', 'compound']),
  ('asset-bio-cross', 'Medical Cross', 'science', 'svg', 'assets/science/medical-cross.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/science/medical-cross.svg', 'image/svg+xml', 120, 120, array['medical', 'hospital', 'health', 'firstaid', 'cross']),
  ('asset-shape-rect', 'Rectangle', 'shapes', 'svg', 'assets/shapes/rectangle.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/shapes/rectangle.svg', 'image/svg+xml', 140, 90, array['shape', 'rectangle', 'box']),
  ('asset-shape-circle', 'Circle', 'shapes', 'svg', 'assets/shapes/circle.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/shapes/circle.svg', 'image/svg+xml', 120, 120, array['shape', 'circle', 'round']),
  ('asset-shape-arrow-r', 'Arrow Right', 'shapes', 'svg', 'assets/shapes/arrow-right.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/shapes/arrow-right.svg', 'image/svg+xml', 130, 70, array['arrow', 'direction', 'pointer', 'pathway']),
  ('asset-shape-star', 'Star', 'shapes', 'svg', 'assets/shapes/star.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/shapes/star.svg', 'image/svg+xml', 120, 120, array['star', 'rating', 'badge', 'favorite']),
  ('asset-icon-target', 'Target / Focus', 'icons', 'svg', 'assets/icons/target-focus.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/icons/target-focus.svg', 'image/svg+xml', 120, 120, array['target', 'focus', 'objective', 'goal', 'bullseye']),
  ('asset-icon-chart', 'Bar Chart', 'icons', 'svg', 'assets/icons/bar-chart.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/icons/bar-chart.svg', 'image/svg+xml', 130, 120, array['chart', 'data', 'graph', 'metrics', 'analytics']),
  ('asset-icon-idea', 'Idea / Lightbulb', 'icons', 'svg', 'assets/icons/idea-lightbulb.svg', 'https://pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev/assets/icons/idea-lightbulb.svg', 'image/svg+xml', 110, 130, array['idea', 'lightbulb', 'solution', 'discovery', 'innovation'])
on conflict (id) do update set
  public_url = excluded.public_url,
  r2_key = excluded.r2_key;

-- ==============================================================================
-- 11. Create the 'profiles' table (User Identity Foundation)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_updated_at on public.profiles (updated_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Strict RLS Policies for Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ==============================================================================
-- 12. Create the 'workspaces' and 'workspace_members' tables (Phase 2)
-- ==============================================================================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  type text not null default 'personal' check (type in ('personal', 'team')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspaces_created_by on public.workspaces (created_by);
create index if not exists idx_workspaces_updated_at on public.workspaces (updated_at desc);

create unique index if not exists idx_workspaces_personal_unique
  on public.workspaces (created_by)
  where (type = 'personal');

drop trigger if exists set_workspaces_updated_at on public.workspaces;
create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row
  execute function public.update_updated_at_column();

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_workspace_members_role on public.workspace_members (workspace_id, role);

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
  before update on public.workspace_members
  for each row
  execute function public.update_updated_at_column();

-- Security Definer Helper: is_workspace_member
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

revoke execute on function public.is_workspace_member(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated, service_role;

-- Enable Row Level Security (RLS)
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- RLS Policies for 'workspaces'
drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id, auth.uid()));

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

-- RLS Policies for 'workspace_members'
drop policy if exists "Members can view workspace memberships" on public.workspace_members;
create policy "Members can view workspace memberships"
  on public.workspace_members
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

-- Provisioning function for personal workspaces
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

  if auth.uid() is not null and auth.uid() <> target_user_id then
    raise exception 'Not authorized to provision workspace for another user';
  end if;

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

  final_name := coalesce(nullif(trim(workspace_name), ''), 'Personal Workspace');

  insert into public.workspaces (name, type, created_by)
  values (final_name, 'personal', target_user_id)
  returning id into new_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, target_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new_ws_id;
exception
  when unique_violation then
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

-- General workspace creation function
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

-- Updated Trigger to automatically provision profile and personal workspace
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_display_name text;
begin
  user_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    user_display_name,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ==============================================================================
-- 9. Canva-Style Link Sharing & Real-Time Design Collaboration (Phase 4)
-- ==============================================================================

create table if not exists public.design_share_links (
  id uuid primary key default gen_random_uuid(),
  design_id text not null references public.designs(id) on delete cascade,
  token text not null,
  token_hash text not null unique,
  permission text not null check (permission in ('view', 'edit')),
  is_enabled boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists idx_design_share_links_design_id
  on public.design_share_links (design_id);

create index if not exists idx_design_share_links_token_hash
  on public.design_share_links (token_hash);

drop trigger if exists set_design_share_links_updated_at on public.design_share_links;
create trigger set_design_share_links_updated_at
  before update on public.design_share_links
  for each row
  execute function public.update_updated_at_column();

alter table public.design_share_links enable row level security;

drop policy if exists "Workspace editors can view design share links" on public.design_share_links;
create policy "Workspace editors can view design share links"
  on public.design_share_links
  for select
  to authenticated
  using (
    exists (
      select 1 from public.designs d
      where d.id = design_share_links.design_id
        and d.workspace_id is not null
        and public.has_workspace_role(d.workspace_id, auth.uid(), array['owner', 'admin', 'editor'])
    )
  );

create or replace function public.hash_share_token(raw_token text)
returns text as $$
begin
  if raw_token is null or length(trim(raw_token)) = 0 then
    return null;
  end if;
  return encode(extensions.digest(raw_token::bytea, 'sha256'), 'hex');
end;
$$ language plpgsql immutable strict set search_path = public, extensions;

revoke execute on function public.hash_share_token(text) from public;
grant execute on function public.hash_share_token(text) to authenticated, anon, service_role;

create or replace function public.get_or_create_design_share_link(
  p_design_id text,
  p_raw_token text default null
)
returns jsonb as $$
declare
  v_caller_id uuid;
  v_workspace_id uuid;
  v_link record;
  v_raw_token text;
  v_token_hash text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  select workspace_id into v_workspace_id
  from public.designs
  where id = p_design_id;

  if v_workspace_id is null then
    raise exception 'Design not found or access denied';
  end if;

  if not public.has_workspace_role(v_workspace_id, v_caller_id, array['owner', 'admin', 'editor']) then
    raise exception 'Only workspace editors, admins, and owners can manage share links';
  end if;

  select * into v_link
  from public.design_share_links
  where design_id = p_design_id;

  if found then
    return jsonb_build_object(
      'id', v_link.id,
      'design_id', v_link.design_id,
      'token', v_link.token,
      'permission', v_link.permission,
      'is_enabled', v_link.is_enabled,
      'expires_at', v_link.expires_at,
      'created_at', v_link.created_at,
      'updated_at', v_link.updated_at
    );
  end if;

  v_raw_token := coalesce(p_raw_token, encode(extensions.gen_random_bytes(32), 'hex'));
  v_token_hash := public.hash_share_token(v_raw_token);

  insert into public.design_share_links (
    design_id,
    token,
    token_hash,
    permission,
    is_enabled,
    created_by
  )
  values (
    p_design_id,
    v_raw_token,
    v_token_hash,
    'view',
    false,
    v_caller_id
  )
  returning * into v_link;

  return jsonb_build_object(
    'id', v_link.id,
    'design_id', v_link.design_id,
    'token', v_link.token,
    'permission', v_link.permission,
    'is_enabled', v_link.is_enabled,
    'expires_at', v_link.expires_at,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
end;
$$ language plpgsql security definer set search_path = public, extensions;

revoke execute on function public.get_or_create_design_share_link(text, text) from public;
grant execute on function public.get_or_create_design_share_link(text, text) to authenticated, service_role;

create or replace function public.update_design_share_link(
  p_design_id text,
  p_is_enabled boolean,
  p_permission text,
  p_regenerate_token boolean default false,
  p_new_raw_token text default null
)
returns jsonb as $$
declare
  v_caller_id uuid;
  v_workspace_id uuid;
  v_link record;
  v_new_token text;
  v_new_token_hash text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required';
  end if;

  if p_permission not in ('view', 'edit') then
    raise exception 'Invalid permission level. Must be view or edit';
  end if;

  select workspace_id into v_workspace_id
  from public.designs
  where id = p_design_id;

  if v_workspace_id is null then
    raise exception 'Design not found or access denied';
  end if;

  if not public.has_workspace_role(v_workspace_id, v_caller_id, array['owner', 'admin', 'editor']) then
    raise exception 'Only workspace editors, admins, and owners can update share links';
  end if;

  if p_regenerate_token then
    v_new_token := coalesce(p_new_raw_token, encode(extensions.gen_random_bytes(32), 'hex'));
    v_new_token_hash := public.hash_share_token(v_new_token);

    update public.design_share_links
    set
      token = v_new_token,
      token_hash = v_new_token_hash,
      is_enabled = p_is_enabled,
      permission = p_permission,
      updated_at = now()
    where design_id = p_design_id
    returning * into v_link;
  else
    update public.design_share_links
    set
      is_enabled = p_is_enabled,
      permission = p_permission,
      updated_at = now()
    where design_id = p_design_id
    returning * into v_link;
  end if;

  if not found then
    raise exception 'Share link configuration not found for this design';
  end if;

  return jsonb_build_object(
    'id', v_link.id,
    'design_id', v_link.design_id,
    'token', v_link.token,
    'permission', v_link.permission,
    'is_enabled', v_link.is_enabled,
    'expires_at', v_link.expires_at,
    'created_at', v_link.created_at,
    'updated_at', v_link.updated_at
  );
end;
$$ language plpgsql security definer set search_path = public, extensions;

revoke execute on function public.update_design_share_link(text, boolean, text, boolean, text) from public;
grant execute on function public.update_design_share_link(text, boolean, text, boolean, text) to authenticated, service_role;

create or replace function public.get_shared_design_by_token(
  p_raw_token text
)
returns jsonb as $$
declare
  v_token_hash text;
  v_link record;
  v_design record;
begin
  if p_raw_token is null or length(trim(p_raw_token)) = 0 then
    return null;
  end if;

  v_token_hash := public.hash_share_token(p_raw_token);
  if v_token_hash is null then
    return null;
  end if;

  select * into v_link
  from public.design_share_links
  where token_hash = v_token_hash;

  if not found then
    return null;
  end if;

  if not v_link.is_enabled then
    return null;
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return null;
  end if;

  select
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
  into v_design
  from public.designs
  where id = v_link.design_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
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
end;
$$ language plpgsql security definer set search_path = public, extensions;

revoke execute on function public.get_shared_design_by_token(text) from public;
grant execute on function public.get_shared_design_by_token(text) to authenticated, anon, service_role;

create or replace function public.update_shared_design_content(
  p_design_id text,
  p_raw_token text,
  p_pages jsonb,
  p_thumbnail text default null
)
returns jsonb as $$
declare
  v_caller_id uuid;
  v_token_hash text;
  v_link record;
  v_design record;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required to edit a shared design';
  end if;

  if p_raw_token is null or length(trim(p_raw_token)) = 0 then
    raise exception 'Valid share token required';
  end if;

  v_token_hash := public.hash_share_token(p_raw_token);
  if v_token_hash is null then
    raise exception 'Invalid share token';
  end if;

  select * into v_link
  from public.design_share_links
  where design_id = p_design_id and token_hash = v_token_hash;

  if not found then
    raise exception 'Share link not found or invalid for this design';
  end if;

  if not v_link.is_enabled then
    raise exception 'Link sharing has been disabled for this design';
  end if;

  if v_link.permission <> 'edit' then
    raise exception 'Share link only grants viewing permissions; editing is forbidden';
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    raise exception 'Share link has expired';
  end if;

  update public.designs
  set
    pages = coalesce(p_pages, pages),
    thumbnail = coalesce(p_thumbnail, thumbnail),
    updated_at = now()
  where id = p_design_id
  returning
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
  into v_design;

  return jsonb_build_object(
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
end;
$$ language plpgsql security definer set search_path = public, extensions;

revoke execute on function public.update_shared_design_content(text, text, jsonb, text) from public;
grant execute on function public.update_shared_design_content(text, text, jsonb, text) to authenticated, service_role;





