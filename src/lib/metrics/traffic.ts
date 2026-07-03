import type { ServiceResult, TrafficData, TrafficDelta } from "./types";
import {
  ga4Configured,
  ga4SourceFor,
  normalizeGa4PropertyId,
  runGa4Report,
  type Ga4Metrics,
} from "./ga4";

const RANGE_DAYS = 30;

const delta = (value: number, prev: number): TrafficDelta => ({
  value,
  prev,
  change_pct: prev > 0 ? Math.round(((value - prev) / prev) * 100) : value > 0 ? 100 : 0,
});

/**
 * Traffic provider. Real Google Analytics 4 when configured + a property id is
 * set; otherwise labeled demo numbers (`demo: true`). GA4 errors degrade to the
 * stub rather than failing the refresh.
 */
export async function runTraffic(
  url: string,
  propertyId?: string | null,
): Promise<ServiceResult<TrafficData>> {
  const property = normalizeGa4PropertyId(propertyId);

  if (ga4SourceFor(ga4Configured(), property) === "real" && property) {
    try {
      const { current, prior, daily, dailyPrev } = await runGa4Report(
        property,
        RANGE_DAYS,
        Date.now(),
      );
      const pick = (m: Ga4Metrics, k: keyof Ga4Metrics) => m[k];
      const toPoint = (p: { date: string; users: number; newUsers: number; sessions: number }) => ({
        date: p.date,
        users: p.users,
        new_users: p.newUsers,
        sessions: p.sessions,
      });
      return {
        ok: true,
        data: {
          demo: false,
          range_days: RANGE_DAYS,
          sessions: current.sessions,
          users: current.users,
          pageviews: current.pageviews,
          new_users: current.newUsers,
          engagement_rate: current.engagementRate,
          avg_engagement_time: current.avgEngagementTime,
          trend_pct: delta(current.sessions, prior.sessions).change_pct,
          deltas: {
            users: delta(pick(current, "users"), pick(prior, "users")),
            new_users: delta(pick(current, "newUsers"), pick(prior, "newUsers")),
            engagement_rate: delta(current.engagementRate, prior.engagementRate),
            avg_engagement_time: delta(current.avgEngagementTime, prior.avgEngagementTime),
          },
          daily: daily.map(toPoint),
          daily_prev: dailyPrev.map(toPoint),
        },
      };
    } catch (err) {
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
 * across refreshes. Includes a plausible daily series + deltas so the redesigned
 * card and comparison chart render fully in demo mode (clearly labeled).
 */
function demoTraffic(url: string): TrafficData {
  let seed = 0;
  for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) >>> 0;
  const rand = (salt: number) => ((seed ^ (salt * 2654435761)) >>> 0) / 0xffffffff;
  const pick = (min: number, max: number, salt: number) => min + Math.floor(rand(salt) * (max - min));

  const users = pick(1400, 7200, 1);
  const newUsers = Math.round(users * (0.45 + rand(2) * 0.2));
  const sessions = Math.round(users * (1.15 + rand(3) * 0.3));
  const pageviews = Math.round(sessions * (1.8 + rand(4) * 1.2));
  const engagementRate = Math.round((48 + rand(5) * 30) * 10) / 10;
  const avgEngTime = pick(40, 160, 6);

  const prevUsers = Math.round(users * (0.82 + rand(7) * 0.3));
  const prevNew = Math.round(newUsers * (0.82 + rand(8) * 0.3));

  // Per-day series (30 pts each window) with a gentle wave so the chart looks real.
  const mkSeries = (base: number, salt: number) =>
    Array.from({ length: RANGE_DAYS }, (_, i) => {
      const d = new Date(Date.now() - (RANGE_DAYS - i) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const wave = 0.7 + 0.6 * Math.abs(Math.sin((i + salt) / 4));
      const u = Math.round((base / RANGE_DAYS) * wave);
      return { date: d, users: u, new_users: Math.round(u * 0.5), sessions: Math.round(u * 1.2) };
    });

  return {
    demo: true,
    range_days: RANGE_DAYS,
    sessions,
    users,
    pageviews,
    new_users: newUsers,
    engagement_rate: engagementRate,
    avg_engagement_time: avgEngTime,
    trend_pct: delta(sessions, Math.round(sessions * 0.85)).change_pct,
    deltas: {
      users: delta(users, prevUsers),
      new_users: delta(newUsers, prevNew),
      engagement_rate: delta(engagementRate, Math.round(engagementRate * 0.95 * 10) / 10),
      avg_engagement_time: delta(avgEngTime, Math.round(avgEngTime * 0.92)),
    },
    daily: mkSeries(users, 0),
    daily_prev: mkSeries(prevUsers, 9),
  };
}
