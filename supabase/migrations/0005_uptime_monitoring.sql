-- Phase 8 — Uptime + SSL-expiry monitoring & alerts.
-- Adds the 'uptime' service, a per-check log, an incident ledger, a per-agency
-- alert-email override, and extends the public dashboard RPC with recent
-- incidents. All new tables are RLS-scoped through owns_client().

-- ---------------------------------------------------------------- service type
-- Widen the service_type check constraints to include 'uptime' (a toggleable
-- service like the others, with its own metric_snapshots rows).
alter table public.client_services
  drop constraint if exists client_services_service_type_check;
alter table public.client_services
  add constraint client_services_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime'));

alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime'));

-- --------------------------------------------------------------- alert routing
-- Optional per-agency override for where downtime/SSL alerts are sent. When
-- null, alerts fall back to the agency owner's auth email (resolved server-side).
alter table public.agencies
  add column if not exists alert_email text;

-- ---------------------------------------------------------------- uptime_checks
create table if not exists public.uptime_checks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  checked_at timestamptz not null default now(),
  is_up boolean not null,
  status_code int,
  response_ms int
);
create index if not exists uptime_checks_lookup_idx
  on public.uptime_checks(client_id, checked_at desc);

-- -------------------------------------------------------------------- incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('downtime','ssl_expiring')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  notified_at timestamptz
);
create index if not exists incidents_lookup_idx
  on public.incidents(client_id, started_at desc);
-- Fast lookup of the single open incident of a given type per client.
create unique index if not exists incidents_one_open_per_type_idx
  on public.incidents(client_id, type) where resolved_at is null;

-- ------------------------------------------------------------------------- RLS
alter table public.uptime_checks enable row level security;
alter table public.incidents     enable row level security;

drop policy if exists uptime_checks_all_own on public.uptime_checks;
create policy uptime_checks_all_own on public.uptime_checks
  for all using (owns_client(client_id)) with check (owns_client(client_id));

drop policy if exists incidents_all_own on public.incidents;
create policy incidents_all_own on public.incidents
  for all using (owns_client(client_id)) with check (owns_client(client_id));

-- ------------------------------------------------- public dashboard RPC (v3)
-- Re-declare with everything from 0003 (client, agency, services, metrics,
-- updated) plus a compact recent-incidents list so the public page can show
-- uptime history without any broad anon table grant.
create or replace function public.get_public_dashboard(dashboard_slug text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'client', jsonb_build_object('company_name', c.company_name, 'website_url', c.website_url, 'logo_url', c.logo_url),
    'agency', jsonb_build_object('name', a.name, 'logo_url', a.logo_url, 'brand_color', a.brand_color),
    'services', (select coalesce(jsonb_agg(cs.service_type),'[]'::jsonb) from client_services cs where cs.client_id=c.id and cs.enabled),
    'metrics', (select coalesce(jsonb_object_agg(m.service_type,m.data),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.data from metric_snapshots ms
       where ms.client_id=c.id order by ms.service_type, ms.captured_at desc) m),
    'updated', (select coalesce(jsonb_object_agg(u.service_type, u.captured_at),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.captured_at from metric_snapshots ms
       where ms.client_id=c.id order by ms.service_type, ms.captured_at desc) u),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', i.type, 'started_at', i.started_at, 'resolved_at', i.resolved_at, 'details', i.details
      ) order by i.started_at desc), '[]'::jsonb)
      from (select * from incidents ix where ix.client_id=c.id order by ix.started_at desc limit 5) i)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
