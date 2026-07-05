-- Polish phase — surface the composite health score + an agency contact on the
-- public dashboard (v7 of get_public_dashboard). Health leads the public page as
-- a hero; the contact email powers the white-label footer. Still one
-- security-definer RPC, no broad anon grants.
create or replace function public.get_public_dashboard(dashboard_slug text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'client', jsonb_build_object('company_name', c.company_name, 'website_url', c.website_url, 'logo_url', c.logo_url),
    'agency', jsonb_build_object('name', a.name, 'logo_url', a.logo_url, 'brand_color', a.brand_color, 'contact_email', a.alert_email),
    'services', (select coalesce(jsonb_agg(cs.service_type),'[]'::jsonb) from client_services cs where cs.client_id=c.id and cs.enabled),
    'health', (select ms.data from metric_snapshots ms
       where ms.client_id=c.id and ms.service_type='health_score'
       order by ms.captured_at desc limit 1),
    'metrics', (select coalesce(jsonb_object_agg(m.service_type,m.data),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.data from metric_snapshots ms
       where ms.client_id=c.id and ms.service_type <> 'health_score' order by ms.service_type, ms.captured_at desc) m),
    'updated', (select coalesce(jsonb_object_agg(u.service_type, u.captured_at),'{}'::jsonb) from
      (select distinct on (ms.service_type) ms.service_type, ms.captured_at from metric_snapshots ms
       where ms.client_id=c.id and ms.service_type <> 'health_score' order by ms.service_type, ms.captured_at desc) u),
    'incidents', (select coalesce(jsonb_agg(jsonb_build_object(
        'type', i.type, 'started_at', i.started_at, 'resolved_at', i.resolved_at, 'details', i.details
      ) order by i.started_at desc), '[]'::jsonb)
      from (select * from incidents ix where ix.client_id=c.id order by ix.started_at desc limit 5) i),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object(
        'title', al.title, 'description', al.description, 'category', al.category, 'performed_at', al.performed_at
      ) order by al.performed_at desc), '[]'::jsonb)
      from (select * from activity_log ax where ax.client_id=c.id order by ax.performed_at desc limit 10) al),
    'trends', jsonb_build_object(
      'page_speed', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'performance_score')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='page_speed'
           and ms.data ? 'performance_score' and ms.data->>'performance_score' is not null
         order by ms.captured_at desc limit 30) s),
      'uptime', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'uptime_pct')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='uptime'
           and ms.data ? 'uptime_pct' and ms.data->>'uptime_pct' is not null
         order by ms.captured_at desc limit 30) s),
      'traffic', (select coalesce(jsonb_agg(v order by ca),'[]'::jsonb) from
        (select (ms.data->>'sessions')::numeric v, ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='traffic'
           and ms.data ? 'sessions' and ms.data->>'sessions' is not null
         order by ms.captured_at desc limit 30) s)
    ),
    'trend_dates', jsonb_build_object(
      'page_speed', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='page_speed'
           and ms.data ? 'performance_score' and ms.data->>'performance_score' is not null
         order by ms.captured_at desc limit 30) s),
      'uptime', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='uptime'
           and ms.data ? 'uptime_pct' and ms.data->>'uptime_pct' is not null
         order by ms.captured_at desc limit 30) s),
      'traffic', (select coalesce(jsonb_agg(ca order by ca),'[]'::jsonb) from
        (select ms.captured_at ca from metric_snapshots ms
         where ms.client_id=c.id and ms.service_type='traffic'
           and ms.data ? 'sessions' and ms.data->>'sessions' is not null
         order by ms.captured_at desc limit 30) s)
    ),
    'annotations', (select coalesce(jsonb_agg(jsonb_build_object(
        'annotation_date', ta.annotation_date, 'label', ta.label,
        'description', ta.description, 'category', ta.category, 'auto', ta.auto
      ) order by ta.annotation_date), '[]'::jsonb)
      from trend_annotations ta where ta.client_id=c.id)
  ) into result
  from clients c join agencies a on a.id=c.agency_id
  where c.slug=dashboard_slug and c.is_active;
  return result;
end $$;

grant execute on function public.get_public_dashboard(text) to anon, authenticated;
