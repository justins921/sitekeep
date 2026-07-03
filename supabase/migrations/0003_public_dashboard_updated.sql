-- Add per-service last-updated timestamps to the public dashboard payload so
-- the white-label page can show "Updated Nh ago" without a broad anon grant.

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
       where ms.client_id=c.id order by ms.service_type, ms.captured_at desc) m),
    'updated', (select coalesce(jsonb_object_agg(u.service_type, u.captured_at),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.captured_at from metric_snapshots ms
       where ms.client_id=c.id order by ms.service_type, ms.captured_at desc) u)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
