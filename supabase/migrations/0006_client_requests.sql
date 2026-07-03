-- Phase 9 — Client request board.
-- Agencies manage change requests per client (RLS via owns_client). The public
-- white-label dashboard lets anonymous visitors submit a request through a
-- security-definer RPC — no broad anon table grant, with validation + a basic
-- per-client rate limit.

create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  priority text check (priority in ('low','medium','high')),
  submitted_by_email text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_requests_lookup_idx
  on public.client_requests(client_id, created_at desc);

alter table public.client_requests enable row level security;

-- Agency (owner) gets full access; anon has NO direct table access — submissions
-- go exclusively through the security-definer RPC below.
drop policy if exists client_requests_all_own on public.client_requests;
create policy client_requests_all_own on public.client_requests
  for all using (owns_client(client_id)) with check (owns_client(client_id));

-- ---------------------------------------------------- public submission RPC
-- Anonymous insert for a given slug, validated + rate-limited. Returns
-- { ok, id } on success or { ok:false, error }. notify_email echoes the
-- agency's configured alert address (never the login email) so the caller's
-- server action can fire the optional key-gated notification — it is used
-- server-side only and never surfaced to the browser.
create or replace function public.submit_client_request(
  dashboard_slug text,
  req_title text,
  req_description text,
  req_email text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target_client uuid;
  notify text;
  recent int;
  clean_title text := btrim(coalesce(req_title, ''));
  clean_desc  text := nullif(btrim(coalesce(req_description, '')), '');
  clean_email text := nullif(btrim(coalesce(req_email, '')), '');
  new_id uuid;
begin
  select c.id, a.alert_email into target_client, notify
  from clients c join agencies a on a.id = c.agency_id
  where c.slug = dashboard_slug and c.is_active;

  if target_client is null then
    return jsonb_build_object('ok', false, 'error', 'Dashboard not found.');
  end if;
  if length(clean_title) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Please add a short summary (at least 3 characters).');
  end if;
  if length(clean_title) > 200 then
    return jsonb_build_object('ok', false, 'error', 'That title is too long.');
  end if;
  if clean_desc is not null and length(clean_desc) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'That description is too long.');
  end if;
  if clean_email is not null and clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'Please enter a valid email address.');
  end if;

  -- Basic anti-abuse: at most 5 submissions per client per hour.
  select count(*) into recent from client_requests
   where client_id = target_client and created_at > now() - interval '1 hour';
  if recent >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many requests right now — please try again later.');
  end if;

  insert into client_requests (client_id, title, description, submitted_by_email)
   values (target_client, clean_title, clean_desc, clean_email)
   returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id, 'notify_email', notify);
end $$;

grant execute on function public.submit_client_request(text, text, text, text) to anon, authenticated;
