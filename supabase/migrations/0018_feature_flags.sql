-- Feature flags — global defaults + per-agency overrides. Powers gated,
-- multi-source features (first user: 'ai_visibility'). Authorization model:
--   • global defaults readable by any authenticated user (getFeature merges them)
--   • an agency's members may read THEIR agency's overrides (is_agency_member)
--   • only super-admins may write either table (is_super_admin, migration 0010)
-- The app also gates /admin by an env allowlist (SUPER_ADMIN_EMAILS); the DB
-- super_admins table backs these RLS checks. Keep the two allowlists in sync.

-- --------------------------------------------------------------- feature_flags
create table if not exists public.feature_flags (
  key text primary key,
  description text,
  default_enabled boolean not null default false,
  default_variant text
);

alter table public.feature_flags enable row level security;

drop policy if exists feature_flags_select on public.feature_flags;
create policy feature_flags_select on public.feature_flags
  for select using (auth.role() = 'authenticated');

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- -------------------------------------------------------- agency_feature_flags
create table if not exists public.agency_feature_flags (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean,
  variant text,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (agency_id, flag_key)
);

alter table public.agency_feature_flags enable row level security;

-- Members read their own agency's overrides; super-admins read all.
drop policy if exists agency_feature_flags_select on public.agency_feature_flags;
create policy agency_feature_flags_select on public.agency_feature_flags
  for select using (public.is_agency_member(agency_id) or public.is_super_admin());

-- Only super-admins write overrides.
drop policy if exists agency_feature_flags_write on public.agency_feature_flags;
create policy agency_feature_flags_write on public.agency_feature_flags
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ------------------------------------------------------------------ seed flag
insert into public.feature_flags (key, description, default_enabled, default_variant)
values (
  'ai_visibility',
  'AI Visibility card — multi-source (off | standalone | clicks)',
  false,
  'off'
)
on conflict (key) do nothing;
