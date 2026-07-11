import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { weekStartUTC } from "./index";
import { computeStreak, incidentFreeDays, type Streak, type WeekPoint } from "./streak";
import type { WeekStatus } from "./score";

export type SiteWeek = WeekPoint;
export type SiteOverview = {
  weeks: SiteWeek[]; // oldest → newest, length = window
  keepScore: number | null; // latest scored week
  status: WeekStatus; // latest week's status
  streak: Streak;
  incidentFreeDays: number | null;
};

/** The last `n` ISO-week Monday starts, oldest → newest. */
function lastNWeekStarts(n: number, now: Date): string[] {
  const cur = new Date(`${weekStartUTC(now)}T00:00:00Z`);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type WeekRow = { client_id: string; week_start: string; score: number | null; status: WeekStatus };

/** Keep Score overview for several sites at once (dashboard). RLS-scoped. */
export async function getSitesOverview(
  supabase: SupabaseClient,
  clientIds: string[],
  weeks = 12,
  now: Date = new Date(),
): Promise<Map<string, SiteOverview>> {
  const out = new Map<string, SiteOverview>();
  if (clientIds.length === 0) return out;

  const window = lastNWeekStarts(weeks, now);
  const [{ data: rows }, { data: incidents }] = await Promise.all([
    supabase
      .from("keep_score_weeks")
      .select("client_id, week_start, score, status")
      .in("client_id", clientIds)
      .gte("week_start", window[0]),
    supabase
      .from("incidents")
      .select("client_id, started_at, resolved_at")
      .in("client_id", clientIds)
      .order("started_at", { ascending: false }),
  ]);

  const byClient = new Map<string, Map<string, WeekRow>>();
  for (const r of (rows as WeekRow[]) ?? []) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, new Map());
    byClient.get(r.client_id)!.set(r.week_start, r);
  }
  const lastIncident = new Map<string, string>();
  for (const inc of incidents ?? []) {
    if (!lastIncident.has(inc.client_id)) {
      lastIncident.set(inc.client_id, (inc.resolved_at as string) ?? (inc.started_at as string));
    }
  }

  for (const id of clientIds) {
    const wk = byClient.get(id) ?? new Map<string, WeekRow>();
    const weekPoints: SiteWeek[] = window.map((weekStart) => {
      const row = wk.get(weekStart);
      return { weekStart, status: row?.status ?? "none", score: row?.score ?? null };
    });
    const scored = [...weekPoints].reverse().find((w) => w.score != null);
    out.set(id, {
      weeks: weekPoints,
      keepScore: scored?.score ?? null,
      status: weekPoints[weekPoints.length - 1]?.status ?? "none",
      streak: computeStreak(weekPoints),
      incidentFreeDays: incidentFreeDays(lastIncident.get(id) ?? null, now),
    });
  }
  return out;
}
