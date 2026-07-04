-- Phase 15 — Composite client health score.
-- One 0–100 number per client, rolling up each ENABLED service equally. The
-- scoring model lives here in SQL as the single source of truth: the refresh
-- action calls compute_client_health() and stores the result as a 'health_score'
-- snapshot; the admin dashboard calls it inline for every client (no N+1); the
-- agency dashboard + client detail read the stored snapshot.

-- Allow the new snapshot type.
alter table public.metric_snapshots
  drop constraint if exists metric_snapshots_service_type_check;
alter table public.metric_snapshots
  add constraint metric_snapshots_service_type_check
  check (service_type in ('page_speed','traffic','security','uptime','health_score'));

-- ------------------------------------------------------- compute_client_health
-- Returns { score, scored_count, enabled_count, services{...} } from the
-- client's latest per-service snapshots. Each enabled service contributes an
-- equal share; a service with no usable data is neutral (it drops out of the
-- denominator rather than scoring 0). Gated to the owner or a super-admin so a
-- definer function can't leak another tenant's score.
create or replace function public.compute_client_health(p_client uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_enabled text[];
  v_data jsonb;
  frac numeric;
  total numeric := 0;
  cnt int := 0;
  breakdown jsonb := '{}'::jsonb;
  perf numeric;
  upct numeric;
  risk text;
  tchange numeric;
  is_demo boolean;
begin
  if not (public.owns_client(p_client) or public.is_super_admin()) then
    return null;
  end if;

  select array_agg(service_type) into v_enabled
  from client_services where client_id = p_client and enabled;

  if v_enabled is null then
    return jsonb_build_object('score', null, 'scored_count', 0,
                              'enabled_count', 0, 'services', '{}'::jsonb);
  end if;

  -- Page Speed — desktop Performance (falls back to mobile if desktop absent).
  if 'page_speed' = any (v_enabled) then
    select data into v_data from metric_snapshots
      where client_id = p_client and service_type = 'page_speed'
      order by captured_at desc limit 1;
    perf := coalesce(
      (v_data->'desktop'->'categories'->>'performance')::numeric,
      (v_data->'mobile'->'categories'->>'performance')::numeric
    );
    if perf is null then
      breakdown := breakdown || jsonb_build_object('page_speed', jsonb_build_object('scored', false));
    else
      frac := case when perf >= 90 then 1
                   when perf >= 50 then perf / 100
                   else 0 end;
      total := total + frac; cnt := cnt + 1;
      breakdown := breakdown || jsonb_build_object('page_speed',
        jsonb_build_object('scored', true, 'value', round(perf), 'fraction', round(frac, 3)));
    end if;
  end if;

  -- Uptime — rolling 30-day %.
  if 'uptime' = any (v_enabled) then
    select data into v_data from metric_snapshots
      where client_id = p_client and service_type = 'uptime'
      order by captured_at desc limit 1;
    upct := (v_data->>'uptime_pct')::numeric;
    if upct is null then
      breakdown := breakdown || jsonb_build_object('uptime', jsonb_build_object('scored', false));
    else
      frac := case when upct >= 99.5 then 1
                   when upct >= 95 then (upct - 95) / 4.5
                   else 0 end;
      total := total + frac; cnt := cnt + 1;
      breakdown := breakdown || jsonb_build_object('uptime',
        jsonb_build_object('scored', true, 'value', upct, 'fraction', round(frac, 3)));
    end if;
  end if;

  -- Security — risk level.
  if 'security' = any (v_enabled) then
    select data into v_data from metric_snapshots
      where client_id = p_client and service_type = 'security'
      order by captured_at desc limit 1;
    risk := v_data->>'risk_level';
    if risk is null then
      breakdown := breakdown || jsonb_build_object('security', jsonb_build_object('scored', false));
    else
      frac := case risk when 'minimal' then 1 when 'low' then 0.75
                        when 'medium' then 0.5 when 'high' then 0.25
                        when 'critical' then 0 else 0.5 end;
      total := total + frac; cnt := cnt + 1;
      breakdown := breakdown || jsonb_build_object('security',
        jsonb_build_object('scored', true, 'value', risk, 'fraction', round(frac, 3)));
    end if;
  end if;

  -- Traffic — 30-day user trend (demo data / no snapshot = neutral).
  if 'traffic' = any (v_enabled) then
    select data into v_data from metric_snapshots
      where client_id = p_client and service_type = 'traffic'
      order by captured_at desc limit 1;
    is_demo := coalesce((v_data->>'demo')::boolean, false);
    tchange := coalesce(
      (v_data->'deltas'->'users'->>'change_pct')::numeric,
      (v_data->>'trend_pct')::numeric
    );
    if v_data is null or is_demo or tchange is null then
      breakdown := breakdown || jsonb_build_object('traffic', jsonb_build_object('scored', false));
    else
      frac := case when tchange >= 0 then 1
                   when tchange >= -10 then 0.75
                   when tchange >= -25 then 0.5
                   else 0.25 end;
      total := total + frac; cnt := cnt + 1;
      breakdown := breakdown || jsonb_build_object('traffic',
        jsonb_build_object('scored', true, 'value', tchange, 'fraction', round(frac, 3)));
    end if;
  end if;

  return jsonb_build_object(
    'score', case when cnt = 0 then null else round(total / cnt * 100) end,
    'scored_count', cnt,
    'enabled_count', array_length(v_enabled, 1),
    'services', breakdown
  );
end $$;

grant execute on function public.compute_client_health(uuid) to authenticated;

-- ----------------------------------------- admin_list_agencies (fill health)
-- Same shape as 0010, but each client's `health` is now the live composite
-- score from compute_client_health() so the admin grid + detail light up.
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
            select max(ms.captured_at) from metric_snapshots ms
            where ms.client_id = c.id and ms.service_type <> 'health_score'
          ),
          'health', (public.compute_client_health(c.id)->>'score')::numeric
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
