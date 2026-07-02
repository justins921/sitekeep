import type { ServiceResult, TrafficData } from "./types";

/**
 * Traffic provider — STUBBED with clearly-labeled demo data (`demo: true`).
 *
 * Real GA4 (Google Analytics Data API via OAuth) lands in a later phase. To
 * swap, replace the body of this function with a call to the GA4 provider and
 * set `demo: false` — nothing else in the app needs to change, because the
 * refresh action, snapshot storage, and UI all read this same shape.
 */
export async function runTraffic(url: string): Promise<ServiceResult<TrafficData>> {
  // Deterministic sample numbers seeded from the URL so the demo stays stable
  // across refreshes (rather than jittering like real data would).
  let seed = 0;
  for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) >>> 0;
  const pick = (min: number, max: number, salt: number) =>
    min + ((seed ^ (salt * 2654435761)) >>> 0) % (max - min);

  const sessions = pick(1800, 9500, 1);
  const users = Math.round(sessions * (0.72 + (pick(0, 20, 2) / 100)));
  const pageviews = Math.round(sessions * (1.8 + pick(0, 120, 3) / 100));
  const trend_pct = pick(0, 34, 4) - 12; // roughly -12%..+22%

  return {
    ok: true,
    data: {
      demo: true,
      range_days: 30,
      sessions,
      users,
      pageviews,
      trend_pct,
    },
  };
}
