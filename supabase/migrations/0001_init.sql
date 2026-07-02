-- SiteKeep initial schema, RLS, triggers and public-dashboard RPC.
-- Multi-tenant: one auth user -> one agency -> many clients.

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Agency',
  logo_url text,
  brand_color text not null default '#4F46E5',
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  company_name text not null,
  website_url text not null,
  contact_email text,
  monthly_rate numeric(10,2) not null default 0,
  logo_url text,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clients_agency_id_idx on public.clients(agency_id);

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_type text not null check (service_type in ('page_speed','traffic','security')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  unique (client_id, service_type)
);

create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_type text not null check (service_type in ('page_speed','traffic','security')),
  data jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);
create index if not exists metric_snapshots_lookup_idx
  on public.metric_snapshots(client_id, service_type, captured_at desc);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade unique,
  cadence text not null default 'monthly' check (cadence in ('monthly','weekly')),
  send_day int not null default 1,
  recipient_email text,
  enabled boolean not null default false,
  last_sent_at timestamptz
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  quantity int not null default 0,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- New-user trigger: auto-create the agency + an inactive subscription row.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_agency_id uuid;
begin
  insert into public.agencies (owner_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'agency_name', ''), 'My Agency')
  )
  returning id into new_agency_id;

  insert into public.subscriptions (agency_id, status, quantity)
  values (new_agency_id, 'inactive', 0);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper: does the current user own the given client?
-- ============================================================================

create or replace function public.owns_client(target_client_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.clients c
    join public.agencies a on a.id = c.agency_id
    where c.id = target_client_id
      and a.owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.agencies         enable row level security;
alter table public.clients          enable row level security;
alter table public.client_services  enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.reports          enable row level security;
alter table public.subscriptions    enable row level security;

-- agencies: owner can read/update their own row.
drop policy if exists agencies_select_own on public.agencies;
create policy agencies_select_own on public.agencies
  for select using (owner_id = auth.uid());

drop policy if exists agencies_update_own on public.agencies;
create policy agencies_update_own on public.agencies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- clients: owner (via agency) gets full access.
drop policy if exists clients_all_own on public.clients;
create policy clients_all_own on public.clients
  for all
  using (agency_id in (select id from public.agencies where owner_id = auth.uid()))
  with check (agency_id in (select id from public.agencies where owner_id = auth.uid()));

-- client_services / metric_snapshots / reports: gated through owns_client().
drop policy if exists client_services_all_own on public.client_services;
create policy client_services_all_own on public.client_services
  for all using (owns_client(client_id)) with check (owns_client(client_id));

drop policy if exists metric_snapshots_all_own on public.metric_snapshots;
create policy metric_snapshots_all_own on public.metric_snapshots
  for all using (owns_client(client_id)) with check (owns_client(client_id));

drop policy if exists reports_all_own on public.reports;
create policy reports_all_own on public.reports
  for all using (owns_client(client_id)) with check (owns_client(client_id));

-- subscriptions: owner select only. Writes happen via the service role in the
-- Stripe webhook (which bypasses RLS), so no insert/update policy is granted.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select
  using (agency_id in (select id from public.agencies where owner_id = auth.uid()));

-- ============================================================================
-- Public dashboard read: one JSON blob keyed on the client slug.
-- ============================================================================

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
       where ms.client_id=c.id order by ms.service_type, ms.captured_at desc) m)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
