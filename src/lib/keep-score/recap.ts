import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSitesOverview, type SiteOverview } from "./overview";
import { weekStartUTC } from "./index";

// Data behind the weekly recap: every active site's Keep Score overview plus an
// account-level rollup. Pure roll-up math is separated so the renderer just
// formats. Reads under whatever client is passed (service role in cron).

export type RecapSite = {
  id: string;
  name: string;
  url: string;
  slug: string;
  overview: SiteOverview;
  /** This week's status change vs. last week, for impact framing. */
  delta: number | null;
};

export type RecapData = {
  agency: {
    id: string;
    name: string;
    brandColor: string | null;
    logoUrl: string | null;
  };
  weekLabel: string; // e.g. "week of Jul 7"
  sites: RecapSite[];
  rollup: {
    siteCount: number;
    healthy: number; // green sites this week
    avgScore: number | null;
    incidentsResolved: number; // resolved incidents in the last 7 days
    bestStreak: number; // longest current green/amber chain across sites
    allGreen: boolean;
  };
};

/** Human week label from the ISO Monday (UTC). */
function weekLabel(now: Date): string {
  const monday = new Date(`${weekStartUTC(now)}T00:00:00Z`);
  return `week of ${monday.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/**
 * Assemble the recap for one agency. Returns null when there's nothing worth
 * sending (no active sites) so the runner can skip cleanly.
 */
export async function buildRecapData(
  supabase: SupabaseClient,
  agencyId: string,
  now: Date = new Date(),
): Promise<RecapData | null> {
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, name, brand_color, logo_url")
    .eq("id", agencyId)
    .single();
  if (!agency) return null;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name, website_url, slug")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .order("company_name");
  if (!clients || clients.length === 0) return null;

  const ids = clients.map((c) => c.id as string);
  const overviews = await getSitesOverview(supabase, ids, 12, now);

  // Resolved incidents in the trailing 7 days (the "impact" the agency delivered).
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: resolved } = await supabase
    .from("incidents")
    .select("client_id")
    .in("client_id", ids)
    .gte("resolved_at", weekAgo);
  const incidentsResolved = resolved?.length ?? 0;

  const sites: RecapSite[] = clients.map((c) => {
    const overview =
      overviews.get(c.id as string) ??
      ({
        weeks: [],
        keepScore: null,
        status: "none",
        streak: { chainWeeks: 0, previousBest: 0, brokeRecently: false },
        incidentFreeDays: null,
      } satisfies SiteOverview);
    const scored = overview.weeks.filter((w) => w.score != null);
    const last = scored.at(-1)?.score ?? null;
    const prev = scored.at(-2)?.score ?? null;
    const delta = last != null && prev != null ? last - prev : null;
    return {
      id: c.id as string,
      name: c.company_name as string,
      url: c.website_url as string,
      slug: c.slug as string,
      overview,
      delta,
    };
  });

  const scores = sites.map((s) => s.overview.keepScore).filter((n): n is number => n != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const healthy = sites.filter((s) => s.overview.status === "green").length;
  const bestStreak = sites.reduce((m, s) => Math.max(m, s.overview.streak.chainWeeks), 0);

  return {
    agency: {
      id: agency.id as string,
      name: agency.name as string,
      brandColor: (agency.brand_color as string) ?? null,
      logoUrl: (agency.logo_url as string) ?? null,
    },
    weekLabel: weekLabel(now),
    sites,
    rollup: {
      siteCount: sites.length,
      healthy,
      avgScore,
      incidentsResolved,
      bestStreak,
      allGreen: sites.length > 0 && healthy === sites.length,
    },
  };
}
