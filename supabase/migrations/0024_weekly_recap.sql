-- Weekly Keep Score recap: one email per account (agency) on Mondays, rolling
-- up every site's Keep Score + green-week grid. State lives on the agency:
-- an opt-out flag and the last-sent stamp (so a same-week cron re-run no-ops).

alter table public.agencies
  add column if not exists weekly_recap_enabled boolean not null default true;
alter table public.agencies
  add column if not exists last_recap_at timestamptz;
