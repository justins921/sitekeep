-- Phase 14 — Super-Admin dashboard.
-- A super-admin allowlist, an is_super_admin() guard, read-only cross-tenant
-- SELECT policies so the request-scoped (RLS) client can power /admin and the
-- "view as agency" support flow, and two security-definer aggregate functions
-- (overview + agency list) that also reach auth.users for owner emails without
-- ever handing the app a service-role key.

-- ------------------------------------------------------------- super_admins
create table if not exists public.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.super_admins enable row level security;

-- A super-admin may see the allowlist; nobody else can (no anon/among-owners read).
drop policy if exists super_admins_select_self on public.super_admins;
create policy super_admins_select_self on public.super_admins
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------- is_super_admin
-- Security-definer so it can read super_admins regardless of the caller's RLS.
-- Defaults to the current user, so policies/RPCs can call is_super_admin().
create or replace function public.is_super_admin(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.super_admins sa where sa.user_id = uid);
$$;

grant execute on function public.is_super_admin(uuid) to authenticated;

-- ------------------------------------------------------------- allowlist seed
-- The super-admin allowlist is defined by EMAIL here, but stored by user_id (per
-- the required schema). Two paths keep it correct regardless of signup order:
--   1. The seed below grants any allowlisted account that ALREADY exists.
--   2. The signup trigger grants an allowlisted account the moment it's created.
-- So the intended admin becomes a super-admin automatically even if they sign up
-- (or re-sign-up) after this migration runs — no manual re-run needed.
--
-- Edit the array in BOTH places to change the allowlist (e.g. to add Payton once
-- his email is known).
create or replace function public.grant_super_admin_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email = any (array['justin.sobojinski@gmail.com']::text[]) then
    insert into public.super_admins (user_id) values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_super_admin on auth.users;
create trigger on_auth_user_super_admin
  after insert on auth.users
  for each row execute function public.grant_super_admin_on_signup();

-- Grant any allowlisted account that exists right now (idempotent).
insert into public.super_admins (user_id)
select id from auth.users
where email = any (array['justin.sobojinski@gmail.com']::text[])
on conflict (user_id) do nothing;

-- ------------------------------------------------- cross-tenant read policies
-- Read-only visibility for super-admins across every tenant table. These are
-- additional PERMISSIVE policies (OR'd with the per-owner ones), so a normal
-- agency owner is unaffected and a super-admin gains SELECT everywhere — which
-- is what both /admin and the read-only "view as agency" flow rely on. No
-- INSERT/UPDATE/DELETE is granted, so impersonation can never mutate a tenant.
do $$
declare t text;
begin
  foreach t in array array[
    'agencies','clients','subscriptions','client_services',
    'metric_snapshots','reports','incidents','uptime_checks',
    'client_requests','activity_log'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_super_admin', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_super_admin())',
      t || '_select_super_admin', t
    );
  end loop;
end $$;

-- ------------------------------------------------------------- admin_overview
-- Platform KPIs in one round trip. MRR/active-dashboards count only paying subs
-- ($3/seat/month). "Trial" = agencies not yet paying (inactive or trialing).
-- Conversion = paying agencies among those past their 30-day free window.
create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare result jsonb;
begin
  if not public.is_super_admin() then
    return null;
  end if;

  select jsonb_build_object(
    'mrr',
      coalesce((select sum(quantity) from subscriptions
                where status in ('active','trialing')), 0) * 3,
    'total_agencies', (select count(*) from agencies),
    'active_dashboards',
      coalesce((select sum(quantity) from subscriptions
                where status in ('active','trialing')), 0),
    'trial_agencies', (
      select count(*) from agencies a
      left join subscriptions s on s.agency_id = a.id
      where coalesce(s.status, 'inactive') in ('inactive', 'trialing')
    ),
    'failed_payments', (
      select count(*) from subscriptions where status in ('past_due', 'unpaid')
    ),
    'conversion_rate', (
      select case when passed = 0 then 0
                  else round(converted::numeric / passed * 100, 1) end
      from (
        select
          count(*) filter (
            where a.created_at < now() - interval '30 days'
          ) as passed,
          count(*) filter (
            where a.created_at < now() - interval '30 days'
              and s.status in ('active', 'trialing')
          ) as converted
        from agencies a
        left join subscriptions s on s.agency_id = a.id
      ) t
    )
  ) into result;

  return result;
end $$;

grant execute on function public.admin_overview() to authenticated;

-- --------------------------------------------------------- admin_list_agencies
-- One row per agency with owner email (from auth.users), subscription/MRR,
-- client counts, last-active timestamp, and a nested clients array (each with
-- enabled services + last refresh). `health` is null here; Phase 15 replaces
-- this function to fill it from the health-score DB function.
create or replace function public.admin_list_agencies()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare result jsonb;
begin
  if not public.is_super_admin() then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      a.id,
      a.name,
      a.created_at,
      u.email as owner_email,
      coalesce(s.status, 'inactive') as status,
      coalesce(s.quantity, 0) as quantity,
      case when coalesce(s.status, '') in ('active', 'trialing')
           then coalesce(s.quantity, 0) * 3 else 0 end as mrr,
      (select count(*) from clients c where c.agency_id = a.id) as client_count,
      (select count(*) from clients c
        where c.agency_id = a.id and c.is_active) as active_client_count,
      greatest(
        (select max(ms.captured_at) from metric_snapshots ms
          join clients c on c.id = ms.client_id where c.agency_id = a.id),
        (select max(cr.created_at) from client_requests cr
          join clients c on c.id = cr.client_id where c.agency_id = a.id)
      ) as last_active,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'company_name', c.company_name,
          'website_url', c.website_url,
          'slug', c.slug,
          'is_active', c.is_active,
          'services', (
            select coalesce(jsonb_agg(cs.service_type order by cs.service_type), '[]'::jsonb)
            from client_services cs where cs.client_id = c.id and cs.enabled
          ),
          'last_refresh', (
            select max(ms.captured_at) from metric_snapshots ms where ms.client_id = c.id
          ),
          'health', null
        ) order by c.created_at desc), '[]'::jsonb)
        from clients c where c.agency_id = a.id
      ) as clients
    from agencies a
    left join subscriptions s on s.agency_id = a.id
    left join auth.users u on u.id = a.owner_id
  ) x;

  return result;
end $$;

grant execute on function public.admin_list_agencies() to authenticated;
