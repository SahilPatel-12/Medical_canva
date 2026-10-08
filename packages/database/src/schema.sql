-- ==============================================================================
-- Medical Canva / Visual Design Platform - Supabase PostgreSQL Schema
-- ==============================================================================

-- 1. Enable required extensions
create extension if not exists "pgcrypto";

-- 2. Create the 'designs' table
create table if not exists public.designs (
  id text primary key default gen_random_uuid()::text,
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
create index if not exists idx_designs_updated_at on public.designs (updated_at desc);
create index if not exists idx_designs_favorite on public.designs (favorite) where favorite = true;

-- 4. Enable Row Level Security (RLS)
alter table public.designs enable row level security;

-- 5. Dev RLS Policies (Allow all operations for development phase)
-- Note: In Phase 2, when user authentication is active, this can be scoped to:
-- (auth.uid() = user_id)
drop policy if exists "Allow all access to designs for development" on public.designs;
create policy "Allow all access to designs for development"
  on public.designs
  for all
  using (true)
  with check (true);

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


