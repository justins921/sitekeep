-- Public bucket for agency logos. Owners can write only inside their own
-- agency-id folder; anyone can read (public white-label dashboards).

insert into storage.buckets (id, name, public)
values ('agency-logos', 'agency-logos', true)
on conflict (id) do nothing;

-- Objects are stored under "<agency_id>/<file>", so the first path segment
-- must be an agency the current user owns.
drop policy if exists "agency_logos_insert" on storage.objects;
create policy "agency_logos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.agencies where owner_id = auth.uid()
    )
  );

drop policy if exists "agency_logos_update" on storage.objects;
create policy "agency_logos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.agencies where owner_id = auth.uid()
    )
  );

drop policy if exists "agency_logos_delete" on storage.objects;
create policy "agency_logos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'agency-logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.agencies where owner_id = auth.uid()
    )
  );

drop policy if exists "agency_logos_read" on storage.objects;
create policy "agency_logos_read" on storage.objects
  for select to public
  using (bucket_id = 'agency-logos');
