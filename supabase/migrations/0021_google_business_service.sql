-- Google Business Profile as a toggleable service (public data via Places API).
-- Adds 'google_business' to the service_type constraints on client_services (the
-- toggle, with config.place_id) and metric_snapshots (its snapshots).

alter table public.client_services
  drop constraint if exists client_services_service_type_check;
alter table public.client_services
  add constraint client_services_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','search_console','accessibility','google_business'));

alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','health_score','search_console','accessibility','google_business'));
