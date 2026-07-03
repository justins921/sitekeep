-- Phase 10 — "What we did this month" activity log.
-- Agencies record maintenance work per client; system entries are auto-created
-- when an incident resolves (Phase 8) or a request is completed (Phase 9).
-- Surfaced on client detail, the public dashboard, and the monthly report.

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  description text,
  category text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists activity_log_lookup_idx
  on public.activity_log(client_id, performed_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_all_own on public.activity_log;
create policy activity_log_all_own on public.activity_log
  for all using (owns_client(client_id)) with check (owns_client(client_id));

-- ----------------------------------------------- public dashboard RPC (v4)
-- Adds recent activity to the payload (on top of incidents from 0005).
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
      from (select * from incidents ix where ix.client_id=c.id order by ix.started_at desc limit 5) i),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', al.title, 'description', al.description, 'category', al.category, 'performed_at', al.performed_at
      ) order by al.performed_at desc), '[]'::jsonb)
      from (select * from activity_log ax where ax.client_id=c.id order by ax.performed_at desc limit 10) al)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
