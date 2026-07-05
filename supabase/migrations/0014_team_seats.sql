-- Feature B — team seats (multiple users per agency).
-- ACCESS CONTROL ONLY — billing stays per-dashboard. Every policy that used to
-- check agencies.owner_id = auth.uid() now checks "auth.uid() is a member of the
-- agency" via agency_members. agencies.owner_id is kept as the billing contact.

-- ============================================================ 1. new tables
create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);
create index if not exists agency_members_user_idx on public.agency_members(user_id);
create index if not exists agency_members_agency_idx on public.agency_members(agency_id);

create table if not exists public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','member')),
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists agency_invitations_agency_idx on public.agency_invitations(agency_id);
create index if not exists agency_invitations_email_idx on public.agency_invitations(lower(email));

-- ============================================================ 2. backfill
-- Every existing agency's owner becomes an 'owner' member. No access regression:
-- the owner keeps full access, now via membership instead of owner_id.
insert into public.agency_members (agency_id, user_id, role)
select id, owner_id, 'owner' from public.agencies
on conflict (agency_id, user_id) do nothing;

-- ============================================================ 3. helpers
-- Security-definer so policies can call them regardless of the caller's own RLS.
create or replace function public.is_agency_member(target_agency uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = target_agency and m.user_id = auth.uid()
  );
$$;
create or replace function public.is_agency_owner(target_agency uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = target_agency and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;
grant execute on function public.is_agency_member(uuid) to authenticated;
grant execute on function public.is_agency_owner(uuid) to authenticated;

-- ============================================================ 4. owns_client()
-- Rewritten to membership. This one change re-points EVERY policy that uses
-- owns_client() (client_services, metric_snapshots, reports, incidents,
-- uptime_checks, client_requests, activity_log, trend_annotations) to grant
-- access to all members of the owning agency.
create or replace function public.owns_client(target_client_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1
    from public.clients c
    join public.agency_members m on m.agency_id = c.agency_id
    where c.id = target_client_id and m.user_id = auth.uid()
  );
$$;

-- ============================================================ 5. direct policies
-- agencies: any member reads + updates (branding). owner_id is protected below.
drop policy if exists agencies_select_own on public.agencies;
drop policy if exists agencies_select_member on public.agencies;
create policy agencies_select_member on public.agencies
  for select using (public.is_agency_member(id));

drop policy if exists agencies_update_own on public.agencies;
drop policy if exists agencies_update_member on public.agencies;
create policy agencies_update_member on public.agencies
  for update using (public.is_agency_member(id)) with check (public.is_agency_member(id));

-- clients: any member gets full access.
drop policy if exists clients_all_own on public.clients;
drop policy if exists clients_all_member on public.clients;
create policy clients_all_member on public.clients
  for all
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));

-- subscriptions: OWNER-ONLY (billing). Writes still happen via the service-role
-- webhook (no write policy). Super-admin read policy from 0010 remains.
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_select_owner on public.subscriptions;
create policy subscriptions_select_owner on public.subscriptions
  for select using (public.is_agency_owner(agency_id));

-- Keep owner_id immutable through the member UPDATE path (defence in depth: a
-- member can edit branding but can't hijack the billing owner).
create or replace function public.protect_agency_owner()
returns trigger language plpgsql as $$
begin
  new.owner_id := old.owner_id;
  return new;
end $$;
drop trigger if exists trg_protect_agency_owner on public.agencies;
create trigger trg_protect_agency_owner before update on public.agencies
  for each row execute function public.protect_agency_owner();

-- ============================================================ 6. RLS: new tables
alter table public.agency_members enable row level security;
alter table public.agency_invitations enable row level security;

-- roster: any member of the agency can read it; super-admins read-only.
drop policy if exists agency_members_select on public.agency_members;
create policy agency_members_select on public.agency_members
  for select using (public.is_agency_member(agency_id) or public.is_super_admin());

-- owner removes members — but never an 'owner' row (can't remove the owner).
-- Inserts happen ONLY via accept_invitation() (security definer), so there is
-- deliberately no INSERT policy for regular users.
drop policy if exists agency_members_delete_owner on public.agency_members;
create policy agency_members_delete_owner on public.agency_members
  for delete using (public.is_agency_owner(agency_id) and role <> 'owner');

-- invitations: owner manages fully; invitees only touch them via definer RPCs.
drop policy if exists agency_invitations_all_owner on public.agency_invitations;
create policy agency_invitations_all_owner on public.agency_invitations
  for all using (public.is_agency_owner(agency_id)) with check (public.is_agency_owner(agency_id));
drop policy if exists agency_invitations_select_super_admin on public.agency_invitations;
create policy agency_invitations_select_super_admin on public.agency_invitations
  for select using (public.is_super_admin());

-- ============================================================ 7. signup trigger
-- Add the owner as a member on normal signup; and DON'T create a stray agency
-- when the new user arrived via an invitation (they'll join on accept).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_agency_id uuid;
  has_invite boolean;
begin
  select exists (
    select 1 from public.agency_invitations i
    where lower(i.email) = lower(new.email)
      and i.status = 'pending' and i.expires_at > now()
  ) into has_invite;

  if has_invite then
    -- Invited: no personal agency. Membership is created by accept_invitation().
    return new;
  end if;

  insert into public.agencies (owner_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'agency_name', ''), 'My Agency')
  )
  returning id into new_agency_id;

  insert into public.agency_members (agency_id, user_id, role)
  values (new_agency_id, new.id, 'owner');

  insert into public.subscriptions (agency_id, status, quantity)
  values (new_agency_id, 'inactive', 0);

  return new;
end $$;

-- ============================================================ 8. invite RPCs
-- Public lookup for the accept page (safe subset; works for anon/any user).
create or replace function public.lookup_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare inv public.agency_invitations; ag_name text;
begin
  select * into inv from public.agency_invitations where token = p_token;
  if inv.id is null then return jsonb_build_object('status', 'not_found'); end if;
  select name into ag_name from public.agencies where id = inv.agency_id;
  return jsonb_build_object(
    'status', case when inv.status <> 'pending' then inv.status
                   when inv.expires_at <= now() then 'expired'
                   else 'pending' end,
    'email', inv.email,
    'agency_name', ag_name,
    'role', inv.role
  );
end $$;
grant execute on function public.lookup_invitation(text) to anon, authenticated;

-- Consume an invite for the logged-in user. Validates status/expiry/email, is
-- idempotent for an already-joined user, and joins the EXISTING agency (never
-- creates one). All the invite edge cases resolve to a typed reason.
create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.agency_invitations; uid uuid; uemail text;
begin
  uid := auth.uid();
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select email into uemail from auth.users where id = uid;

  select * into inv from public.agency_invitations where token = p_token for update;
  if inv.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if inv.status = 'revoked' then return jsonb_build_object('ok', false, 'reason', 'revoked'); end if;

  if inv.status = 'accepted' then
    if exists (select 1 from public.agency_members m
               where m.agency_id = inv.agency_id and m.user_id = uid) then
      return jsonb_build_object('ok', true, 'agency_id', inv.agency_id, 'already', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_used');
  end if;

  if inv.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if lower(inv.email) <> lower(coalesce(uemail, '')) then
    return jsonb_build_object('ok', false, 'reason', 'wrong_email', 'invited_email', inv.email);
  end if;

  insert into public.agency_members (agency_id, user_id, role)
  values (inv.agency_id, uid, inv.role)
  on conflict (agency_id, user_id) do nothing;

  update public.agency_invitations set status = 'accepted' where id = inv.id;
  return jsonb_build_object('ok', true, 'agency_id', inv.agency_id);
end $$;
grant execute on function public.accept_invitation(text) to authenticated;

-- Team page data in one call: members (with email) + pending invites (owner only).
create or replace function public.team_roster()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare my_agency uuid; my_role text; result jsonb;
begin
  select m.agency_id, m.role into my_agency, my_role
  from public.agency_members m where m.user_id = auth.uid()
  order by (m.role = 'owner') desc, m.created_at asc limit 1;
  if my_agency is null then return null; end if;

  select jsonb_build_object(
    'agency_id', my_agency,
    'my_role', my_role,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', mm.user_id, 'email', u.email, 'role', mm.role,
        'created_at', mm.created_at, 'is_me', mm.user_id = auth.uid()
      ) order by (mm.role = 'owner') desc, mm.created_at asc), '[]'::jsonb)
      from public.agency_members mm join auth.users u on u.id = mm.user_id
      where mm.agency_id = my_agency
    ),
    'invitations', case when my_role = 'owner' then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'role', i.role, 'status', i.status,
        'expires_at', i.expires_at, 'created_at', i.created_at
      ) order by i.created_at desc), '[]'::jsonb)
      from public.agency_invitations i
      where i.agency_id = my_agency and i.status = 'pending'
    ) else '[]'::jsonb end
  ) into result;
  return result;
end $$;
grant execute on function public.team_roster() to authenticated;
