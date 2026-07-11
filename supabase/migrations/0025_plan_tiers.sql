-- Billing model v2: flat Solo/Agency tiers with site caps + a card-required
-- 14-day Stripe trial (replaces the per-dashboard-seat model). The subscription
-- now records which plan + interval the agency is on, its trial end, whether it
-- will cancel at period end, and when the day-12 reminder was sent.

alter table public.subscriptions
  add column if not exists plan text check (plan in ('solo','agency')),
  add column if not exists billing_interval text check (billing_interval in ('month','year')),
  add column if not exists trial_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists trial_reminder_sent_at timestamptz;
