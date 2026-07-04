-- Phase 16 — Trend annotations.
-- Contextual notes an agency pins to a client's trend charts ("redesign shipped",
-- "campaign launched", "downtime resolved"). Manual notes are CRUD'd by the owner
-- under RLS; auto-notes are written by the cron/refresh (marked auto = true so the
-- agency can delete ones that aren't meaningful). The public dashboard reads them
-- read-only through the existing security-definer RPC — no broad anon grant.

create table if not exists public.trend_annotations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  annotation_date date not null,
  label text not null,
  description text,
  category text check (category in ('redesign','campaign','update','incident','other')),
  auto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trend_annotations_lookup_idx
  on public.trend_annotations(client_id, annotation_date);

alter table public.trend_annotations enable row level security;

-- Owner (via owns_client) gets full CRUD.
drop policy if exists trend_annotations_all_own on public.trend_annotations;
create policy trend_annotations_all_own on public.trend_annotations
  for all using (owns_client(client_id)) with check (owns_client(client_id));

-- Super-admins get read-only cross-tenant visibility (consistent with 0010).
drop policy if exists trend_annotations_select_super_admin on public.trend_annotations;
create policy trend_annotations_select_super_admin on public.trend_annotations
  for select using (public.is_super_admin());

-- ------------------------------------------------- public dashboard RPC (v6)
-- Everything from v5 (0008) plus: per-metric trend DATES aligned with the value
-- arrays (so the public chart can place annotation markers on a time axis), and
-- the client's annotations (read-only).
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
       where ms.client_id=c.id and ms.service_type <> 'health_score' order by ms.service_type, ms.captured_at desc) m),
    'updated', (select coalesce(jsonb_object_agg(u.service_type, u.captured_at),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.captured_at from metric_snapshots ms
       where ms.client_id=c.id and ms.service_type <> 'health_score' order by ms.service_type, ms.captured_at desc) u),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', i.type, 'started_at', i.started_at, 'resolved_at', i.resolved_at, 'details', i.details
      ) order by i.started_at desc), '[]'::jsonb)
      from (select * from incidents ix where ix.client_id=c.id order by ix.started_at desc limit 5) i),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', al.title, 'description', al.description, 'category', al.category, 'performed_at', al.performed_at
      ) order by al.performed_at desc), '[]'::jsonb)
      from (select * from activity_log ax where ax.client_id=c.id order by ax.performed_at desc limit 10) al),
    'trends', jsonb_build_object(
      'page_speed', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'performance_score')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='page_speed'
           and ms.data ? 'performance_score' and ms.data->>'performance_score' is not null
         order by ms.captured_at desc limit 30) s),
      'uptime', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'uptime_pct')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='uptime'
           and ms.data ? 'uptime_pct' and ms.data->>'uptime_pct' is not null
         order by ms.captured_at desc limit 30) s),
      'traffic', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'sessions')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='traffic'
           and ms.data ? 'sessions' and ms.data->>'sessions' is not null
         order by ms.captured_at desc limit 30) s)
    ),
    'trend_dates', jsonb_build_object(
      'page_speed', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='page_speed'
           and ms.data ? 'performance_score' and ms.data->>'performance_score' is not null
         order by ms.captured_at desc limit 30) s),
      'uptime', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='uptime'
           and ms.data ? 'uptime_pct' and ms.data->>'uptime_pct' is not null
         order by ms.captured_at desc limit 30) s),
      'traffic', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='traffic'
           and ms.data ? 'sessions' and ms.data->>'sessions' is not null
         order by ms.captured_at desc limit 30) s)
    ),
    'annotations', (select coalesce(jsonb_agg(jsonb_build_object(
        'annotation_date', ta.annotation_date, 'label', ta.label,
        'description', ta.description, 'category', ta.category, 'auto', ta.auto
      ) order by ta.annotation_date), '[]'::jsonb)
      from trend_annotations ta where ta.client_id=c.id)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
