-- Feature A — Google Search Console as a toggleable service.
-- Adds 'search_console' to the service_type constraints on client_services (a
-- toggle with its own config.gsc_site_url) and metric_snapshots (its snapshots).
-- No new credential: it reuses the GA4 service account, so nothing else changes.

alter table public.client_services
  drop constraint if exists client_services_service_type_check;
alter table public.client_services
  add constraint client_services_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','search_console'));

alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','health_score','search_console'));
