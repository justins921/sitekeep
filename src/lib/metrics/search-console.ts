import type { GscDelta, SearchConsoleData, ServiceResult } from "./types";
import {
  gscConfigured,
  gscSourceFor,
  normalizeGscSiteUrl,
  runSearchConsoleReport,
} from "./gsc";

const RANGE_DAYS = 28;

const delta = (value: number, prev: number): GscDelta => ({
  value,
  prev,
  change_pct: prev > 0 ? Math.round(((value - prev) / prev) * 100) : value > 0 ? 100 : 0,
});

/** Position delta: lower is better, so express change as (prev - value). */
const positionDelta = (value: number, prev: number): GscDelta => ({
  value,
  prev,
  // Positive change_pct = improvement (moved up the results).
  change_pct: prev > 0 ? Math.round(((prev - value) / prev) * 100) : 0,
});

function notConnected(siteUrl: string | null): SearchConsoleData {
  const zero: GscDelta = { value: 0, prev: 0, change_pct: 0 };
  return {
    connected: false,
    range_days: RANGE_DAYS,
    site_url: siteUrl,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
    deltas: { clicks: zero, impressions: zero, ctr: zero, position: zero },
    top_queries: [],
    daily: [],
    daily_prev: [],
  };
}

/**
 * Search Console provider. Real data only when the shared service account is
 * configured AND the client has a mapped property the account can read;
 * otherwise a clean "not connected" empty state. API errors degrade to the same
 * empty state rather than failing the refresh or fabricating numbers.
 */
export async function runSearchConsole(
  _url: string,
  gscSiteUrl?: string | null,
): Promise<ServiceResult<SearchConsoleData>> {
  const site = normalizeGscSiteUrl(gscSiteUrl);

  if (gscSourceFor(gscConfigured(), site) !== "real" || !site) {
    return { ok: true, data: notConnected(site) };
  }

  try {
    const { current, prior, topQueries, daily, dailyPrev } = await runSearchConsoleReport(
      site,
      RANGE_DAYS,
      Date.now(),
    );
    return {
      ok: true,
      data: {
        connected: true,
        range_days: RANGE_DAYS,
        site_url: site,
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: current.ctr,
        position: current.position,
        deltas: {
          clicks: delta(current.clicks, prior.clicks),
          impressions: delta(current.impressions, prior.impressions),
          ctr: delta(current.ctr, prior.ctr),
          position: positionDelta(current.position, prior.position),
        },
        top_queries: topQueries,
        daily,
        daily_prev: dailyPrev,
      },
    };
  } catch (err) {
    console.warn(
      `[search_console] read failed for ${site}; showing not-connected.`,
      err instanceof Error ? err.message : err,
    );
    return { ok: true, data: notConnected(site) };
  }
}
