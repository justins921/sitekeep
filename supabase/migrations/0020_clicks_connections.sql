-- Productize the Clicks provider: a per-CLIENT project mapping and a per-AGENCY
-- credential (replacing the single global env cookie of the POC). Two auth modes:
--   'session' — the pilot cookie (_search_session)
--   'token'   — an official Bearer token (when Clicks provides one)

-- Per-client Clicks project id (nullable; null = not mapped).
alter table public.clients
  add column if not exists clicks_project_id integer;

-- Per-agency Clicks connection. One row per agency.
create table if not exists public.agency_clicks_connections (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  auth_mode text not null default 'session' check (auth_mode in ('session','token')),
  credential text not null,
  updated_at timestamptz not null default now()
);

alter table public.agency_clicks_connections enable row level security;

-- Agency members manage their own connection; super-admins may read.
drop policy if exists agency_clicks_connections_all on public.agency_clicks_connections;
create policy agency_clicks_connections_all on public.agency_clicks_connections
  for all using (public.is_agency_member(agency_id)) with check (public.is_agency_member(agency_id));

drop policy if exists agency_clicks_connections_super on public.agency_clicks_connections;
create policy agency_clicks_connections_super on public.agency_clicks_connections
  for select using (public.is_super_admin());
