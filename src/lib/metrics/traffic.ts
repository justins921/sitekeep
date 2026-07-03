import type { ServiceResult, TrafficData } from "./types";
import { ga4Configured, ga4SourceFor, normalizeGa4PropertyId, runGa4Report } from "./ga4";

const RANGE_DAYS = 30;

/**
 * Traffic provider. Uses real Google Analytics 4 data when the account is
 * configured (GA4_SERVICE_ACCOUNT_KEY/JSON) AND the client has a GA4 property
 * id; otherwise returns clearly-labeled demo numbers (`demo: true`). The
 * persisted shape is identical either way, so nothing downstream changes. GA4
 * errors (missing access, API failure) degrade gracefully to the stub rather
 * than failing the refresh — the dashboard shows a "not connected" state.
 */
export async function runTraffic(
  url: string,
  propertyId?: string | null,
): Promise<ServiceResult<TrafficData>> {
  const property = normalizeGa4PropertyId(propertyId);

  if (ga4SourceFor(ga4Configured(), property) === "real" && property) {
    try {
      const { current, prior, daily } = await runGa4Report(property, RANGE_DAYS, Date.now());
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
          daily,
        },
      };
    } catch (err) {
      // Never crash the refresh — fall back to the labeled demo stub.
      console.warn(
        `[traffic] GA4 read failed for property ${property}; using demo data.`,
        err instanceof Error ? err.message : err,
      );
      return { ok: true, data: demoTraffic(url) };
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
