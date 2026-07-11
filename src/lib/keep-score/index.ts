import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PageSpeedData, SecurityData, UptimeData } from "@/lib/metrics/types";
import { computeKeepScore, weekStatus, type KeepInputs, type KeepScoreResult, type WeekStatus } from "./score";
import {
  normalizeForm,
  normalizeLinks,
  normalizePerformance,
  normalizeSslDomain,
  normalizeUptime,
} from "./normalize";

export * from "./score";

/** Monday (UTC) of the ISO week containing `date`, as YYYY-MM-DD. */
export function weekStartUTC(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Latest snapshot data for one service_type (RLS-scoped). */
async function latest<T>(supabase: SupabaseClient, clientId: string, type: string): Promise<T | null> {
  const { data } = await supabase
    .from("metric_snapshots")
    .select("data")
    .eq("client_id", clientId)
    .eq("service_type", type)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.data as T) ?? null;
}

/** Optional new-dimension inputs (form/links/domain), read from client config
 * snapshots when their providers exist; null until then. */
type ExtraInputs = {
  formDeliveryPct?: number | null;
  linksOkPct?: number | null;
  domainDaysToExpiry?: number | null;
};

/** Assemble Keep Score sub-scores from the latest stored monitoring data. */
export async function gatherKeepInputs(
  supabase: SupabaseClient,
  clientId: string,
  extra: ExtraInputs = {},
): Promise<KeepInputs> {
  const [uptime, ps, sec] = await Promise.all([
    latest<UptimeData>(supabase, clientId, "uptime"),
    latest<PageSpeedData>(supabase, clientId, "page_speed"),
    latest<SecurityData>(supabase, clientId, "security"),
  ]);

  const perf = ps?.mobile?.categories.performance ?? ps?.desktop?.categories.performance ?? null;

  return {
    uptime: normalizeUptime(uptime?.uptime_pct ?? null),
    performance: normalizePerformance(perf),
    ssl_domain: sec
      ? normalizeSslDomain({
          sslValid: sec.ssl_valid,
          sslDaysToExpiry: sec.ssl_days_to_expiry,
          domainDaysToExpiry: extra.domainDaysToExpiry ?? null,
        })
      : null,
    form: normalizeForm(extra.formDeliveryPct ?? null),
    links: normalizeLinks(extra.linksOkPct ?? null),
  };
}

/** Incident flags for the ISO week containing `now` (for week status/streak). */
async function weekIncidents(
  supabase: SupabaseClient,
  clientId: string,
  weekStart: string,
): Promise<{ unresolved: boolean; resolved: boolean }> {
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const { data } = await supabase
    .from("incidents")
    .select("resolved_at, started_at")
    .eq("client_id", clientId)
    .lt("started_at", weekEnd.toISOString());

  let unresolved = false;
  let resolved = false;
  for (const inc of data ?? []) {
    if (inc.resolved_at == null) unresolved = true;
    else if (inc.resolved_at >= weekStart) resolved = true;
  }
  return { unresolved, resolved };
}

export type KeepScoreStored = {
  result: KeepScoreResult;
  weekStart: string;
  status: WeekStatus;
};

/**
 * Compute the Keep Score for a client from its latest monitoring data, store a
 * `keep_score` snapshot, and upsert the current ISO-week rollup (score + status
 * + incident flags) that feeds the green-week grid + streak. Best-effort.
 */
export async function computeAndStoreKeepScore(
  supabase: SupabaseClient,
  clientId: string,
  now: Date,
  extra: ExtraInputs = {},
): Promise<KeepScoreStored | null> {
  const inputs = await gatherKeepInputs(supabase, clientId, extra);
  const result = computeKeepScore(inputs);
  if (result.score == null) return null;

  const weekStart = weekStartUTC(now);
  const incidents = await weekIncidents(supabase, clientId, weekStart);
  const status = weekStatus(result.score, {
    unresolvedIncident: incidents.unresolved,
    resolvedIncident: incidents.resolved,
  });

  await supabase.from("metric_snapshots").insert({
    client_id: clientId,
    service_type: "keep_score",
    data: { score: result.score, contributions: result.contributions, measured: result.measured },
  });

  await supabase.from("keep_score_weeks").upsert(
    {
      client_id: clientId,
      week_start: weekStart,
      score: result.score,
      status,
      breakdown: { contributions: result.contributions },
      unresolved_incident: incidents.unresolved,
      resolved_incident: incidents.resolved,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,week_start" },
  );

  return { result, weekStart, status };
}
