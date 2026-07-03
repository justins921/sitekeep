import type { ServiceResult, TrafficData } from "./types";
import { ga4Configured, normalizeGa4PropertyId, runGa4Report } from "./ga4";

const RANGE_DAYS = 30;

/**
 * Traffic provider. Uses real Google Analytics 4 data when the account is
 * configured (GA4_SERVICE_ACCOUNT_JSON) AND the client has a GA4 property id;
 * otherwise returns clearly-labeled demo numbers (`demo: true`) so the
 * dashboard still renders during setup. The persisted shape is identical either
 * way, so nothing downstream needs to change.
 */
export async function runTraffic(
  url: string,
  propertyId?: string | null,
): Promise<ServiceResult<TrafficData>> {
  const property = normalizeGa4PropertyId(propertyId);

  if (ga4Configured() && property) {
    try {
      const { current, prior } = await runGa4Report(property, RANGE_DAYS, Date.now());
      const trend_pct =
        prior.sessions > 0
          ? Math.round(((current.sessions - prior.sessions) / prior.sessions) * 100)
          : current.sessions > 0
            ? 100
            : 0;
      return {
        ok: true,
        data: {
          demo: false,
          range_days: RANGE_DAYS,
          sessions: current.sessions,
          users: current.users,
          pageviews: current.pageviews,
          trend_pct,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "GA4 request failed.",
      };
    }
  }

  return { ok: true, data: demoTraffic(url) };
}

/**
 * Deterministic sample numbers seeded from the URL so the demo stays stable
 * across refreshes (rather than jittering like real data would). Used until a
 * GA4 property is connected for the client.
 */
function demoTraffic(url: string): TrafficData {
  let seed = 0;
  for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) >>> 0;
  const pick = (min: number, max: number, salt: number) =>
    min + ((seed ^ (salt * 2654435761)) >>> 0) % (max - min);

  const sessions = pick(1800, 9500, 1);
  const users = Math.round(sessions * (0.72 + pick(0, 20, 2) / 100));
  const pageviews = Math.round(sessions * (1.8 + pick(0, 120, 3) / 100));
  const trend_pct = pick(0, 34, 4) - 12; // roughly -12%..+22%

  return {
    demo: true,
    range_days: RANGE_DAYS,
    sessions,
    users,
    pageviews,
    trend_pct,
  };
}
