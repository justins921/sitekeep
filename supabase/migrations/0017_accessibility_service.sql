-- Accessibility (WCAG) scan as a toggleable service.
-- Adds 'accessibility' to the service_type constraints on client_services (a
-- toggle) and metric_snapshots (its snapshots). No new credential: it reuses the
-- same Lighthouse/PageSpeed response as page_speed, so nothing else changes.

alter table public.client_services
  drop constraint if exists client_services_service_type_check;
alter table public.client_services
  add constraint client_services_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','search_console','accessibility'));

alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','health_score','search_console','accessibility'));
