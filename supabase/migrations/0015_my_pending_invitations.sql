-- Feature B (follow-up) — let an invited user discover their own pending invites.
-- Used by /join, the landing for an authenticated user who belongs to no agency
-- yet (signed up via an invite but hasn't accepted). Security-definer + scoped to
-- the caller's own email, so it never leaks another person's invitations.
create or replace function public.my_pending_invitations()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare uemail text; result jsonb;
begin
  select email into uemail from auth.users where id = auth.uid();
  if uemail is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'token', i.token, 'agency_name', a.name, 'role', i.role, 'expires_at', i.expires_at
  ) order by i.created_at desc), '[]'::jsonb)
  into result
  from public.agency_invitations i
  join public.agencies a on a.id = i.agency_id
  where lower(i.email) = lower(uemail)
    and i.status = 'pending' and i.expires_at > now();

  return result;
end $$;
grant execute on function public.my_pending_invitations() to authenticated;
