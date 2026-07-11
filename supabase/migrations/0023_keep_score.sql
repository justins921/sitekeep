-- Keep Score storage: a per-check snapshot ('keep_score' in metric_snapshots)
-- and a weekly rollup that feeds the green-week grid + streak.

alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','health_score','search_console','accessibility','google_business','keep_score'));

-- Weekly rollup: one row per site per ISO-week.
create table if not exists public.keep_score_weeks (
  client_id uuid not null references public.clients(id) on delete cascade,
  week_start date not null,                 -- Monday (UTC) of the ISO week
  score int,                                -- 0–100 (null = no data)
  status text not null default 'none' check (status in ('green','amber','red','none')),
  breakdown jsonb not null default '{}'::jsonb,
  unresolved_incident boolean not null default false,
  resolved_incident boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (client_id, week_start)
);
create index if not exists keep_score_weeks_client_idx
  on public.keep_score_weeks(client_id, week_start desc);

alter table public.keep_score_weeks enable row level security;

-- Members read + write their own clients' weeks (writes happen on the refresh
-- path under the member's session); super-admins read all.
drop policy if exists keep_score_weeks_all on public.keep_score_weeks;
create policy keep_score_weeks_all on public.keep_score_weeks
  for all using (public.owns_client(client_id)) with check (public.owns_client(client_id));

drop policy if exists keep_score_weeks_super on public.keep_score_weeks;
create policy keep_score_weeks_super on public.keep_score_weeks
  for select using (public.is_super_admin());
