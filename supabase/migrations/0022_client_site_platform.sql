-- Store the detected website builder per client (hidden upsell-targeting signal).
-- Populated on refresh from the homepage HTML. Nullable = not yet checked.
alter table public.clients
  add column if not exists site_platform text,
  add column if not exists site_platform_checked_at timestamptz;
