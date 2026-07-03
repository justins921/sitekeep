-- Per-client Google Analytics 4 property id. When set (and the GA4 service
-- account is configured server-side), the traffic provider pulls real GA4 data
-- for this client; otherwise the dashboard shows labeled demo numbers.
-- Not exposed by get_public_dashboard, so it never leaks to the public page.
alter table public.clients
  add column if not exists ga4_property_id text;
