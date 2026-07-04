import type { SupabaseClient } from "@supabase/supabase-js";

// Trend series pulled from historical metric_snapshots. Client-safe (no
// server-only imports): getTrendSeries just takes whatever Supabase client it's
// given, so it works from server components and the report runner alike.

export type TrendKey = "page_speed" | "uptime" | "traffic";
export type TrendSeries = Record<TrendKey, number[]>;

export const TREND_KEYS: TrendKey[] = ["page_speed", "uptime", "traffic"];

export const TREND_META: Record<
  TrendKey,
  { label: string; unit: string; color: string; field: string; digits: number }
> = {
  page_speed: { label: "Page speed", unit: "", color: "#0068ff", field: "performance_score", digits: 0 },
  uptime: { label: "Uptime", unit: "%", color: "#6cad45", field: "uptime_pct", digits: 1 },
  traffic: { label: "Sessions", unit: "", color: "#cb52cc", field: "sessions", digits: 0 },
};

export function emptyTrends(): TrendSeries {
  return { page_speed: [], uptime: [], traffic: [] };
}

/** A trend point carrying its capture time, for time-axis (annotated) charts. */
export type DatedPoint = { t: number; v: number };
export type DatedTrendSeries = Record<TrendKey, DatedPoint[]>;

export function emptyDatedTrends(): DatedTrendSeries {
  return { page_speed: [], uptime: [], traffic: [] };
}

/**
 * Like getTrendSeries but keeps each point's capture timestamp (ms), so the
 * chart can plot a real time axis and place annotation markers by date.
 */
export async function getDatedTrendSeries(
  supabase: SupabaseClient,
  clientId: string,
  limit = 30,
): Promise<DatedTrendSeries> {
  const { data } = await supabase
    .from("metric_snapshots")
    .select("service_type, data, captured_at")
    .eq("client_id", clientId)
    .in("service_type", TREND_KEYS)
    .order("captured_at", { ascending: true });

  const out = emptyDatedTrends();
  for (const row of data ?? []) {
    const key = row.service_type as TrendKey;
    if (!TREND_KEYS.includes(key)) continue;
    const d = row.data as Record<string, unknown> | null;
    const raw =
      key === "page_speed"
        ? (d?.mobile as { categories?: { performance?: unknown } } | undefined)?.categories
            ?.performance ?? d?.performance_score
        : d?.[TREND_META[key].field];
    if (raw === null || raw === undefined) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) {
      out[key].push({ t: new Date(row.captured_at as string).getTime(), v: n });
    }
  }
  for (const key of TREND_KEYS) {
    if (out[key].length > limit) out[key] = out[key].slice(-limit);
  }
  return out;
}

/** Build a dated series from the public RPC's aligned value + date arrays. */
export function datedFromRpc(
  trends: Partial<Record<TrendKey, number[]>> | null | undefined,
  dates: Partial<Record<TrendKey, string[]>> | null | undefined,
): DatedTrendSeries {
  const out = emptyDatedTrends();
  for (const key of TREND_KEYS) {
    const vs = trends?.[key] ?? [];
    const ds = dates?.[key] ?? [];
    out[key] = vs
      .map((v, i) => ({ t: ds[i] ? new Date(ds[i]).getTime() : NaN, v }))
      .filter((p) => Number.isFinite(p.t));
  }
  return out;
}

/**
 * Chronological value series per metric from snapshot history (oldest→newest),
 * capped to the last `limit` points each. Skips null/non-numeric samples.
 */
export async function getTrendSeries(
  supabase: SupabaseClient,
  clientId: string,
  limit = 30,
): Promise<TrendSeries> {
  const { data } = await supabase
    .from("metric_snapshots")
    .select("service_type, data, captured_at")
    .eq("client_id", clientId)
    .in("service_type", TREND_KEYS)
    .order("captured_at", { ascending: true });

  const out = emptyTrends();
  for (const row of data ?? []) {
    const key = row.service_type as TrendKey;
    if (!TREND_KEYS.includes(key)) continue;
    const d = row.data as Record<string, unknown> | null;
    // Page speed nests the score under mobile.categories.performance in the new
    // shape; fall back to the legacy top-level performance_score.
    const raw =
      key === "page_speed"
        ? (d?.mobile as { categories?: { performance?: unknown } } | undefined)?.categories
            ?.performance ?? d?.performance_score
        : d?.[TREND_META[key].field];
    if (raw === null || raw === undefined) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) out[key].push(n);
  }
  for (const key of TREND_KEYS) {
    if (out[key].length > limit) out[key] = out[key].slice(-limit);
  }
  return out;
}
