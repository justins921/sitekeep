// NOTE: no "server-only" — the PURE helpers (normalizeGscSiteUrl, gscSourceFor)
// are unit-tested outside Next. The network/crypto paths only run server-side
// (called by the search-console provider in server actions / cron).
import { createSign } from "node:crypto";
import { getServiceAccount } from "./ga4";
import { normalizeGscSiteUrl, gscSourceFor } from "./gsc-util";
import type { GscDayPoint, GscQuery } from "./types";

export { normalizeGscSiteUrl, gscSourceFor };

/**
 * Minimal Google Search Console (Search Analytics) client. REUSES the same
 * service account as GA4 (GA4_SERVICE_ACCOUNT_KEY) — the agency grants that same
 * service-account email access to their Search Console property, so there's no
 * separate OAuth. Only the OAuth SCOPE differs (webmasters.readonly), so we sign
 * a scope-specific JWT here rather than reusing GA4's analytics-scoped token.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

/** GSC is configured when the shared service account is present. */
export function gscConfigured(): boolean {
  return getServiceAccount() !== null;
}

const base64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(now: number): Promise<string> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("Service account not configured.");
  const cacheKey = `${sa.client_email}|gsc`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 60_000) return cached.token;

  const iat = Math.floor(now / 1000);
  const claims = { iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat, exp: iat + 3600 };
  const header = { alg: "RS256", typ: "JWT" };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(sa.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(sa.token_uri!, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Token exchange failed (${res.status}).`);
  }
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

type SearchAnalyticsRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type SearchAnalyticsResponse = { rows?: SearchAnalyticsRow[]; error?: { message?: string } };

async function query(
  siteUrl: string,
  token: string,
  body: Record<string, unknown>,
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json()) as SearchAnalyticsResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Search Console API returned ${res.status}.`);
  }
  return json.rows ?? [];
}

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export type GscTotals = { clicks: number; impressions: number; ctr: number; position: number };
export type GscReport = {
  current: GscTotals;
  prior: GscTotals;
  topQueries: GscQuery[];
  daily: GscDayPoint[];
  dailyPrev: GscDayPoint[];
};

const DAY = 86_400_000;
// Search Console data finalizes with a ~2-day lag; end the window there.
const LAG_DAYS = 2;

const emptyTotals = (): GscTotals => ({ clicks: 0, impressions: 0, ctr: 0, position: 0 });

function toTotals(rows: SearchAnalyticsRow[]): GscTotals {
  const r = rows[0];
  if (!r) return emptyTotals();
  return {
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: Math.round((r.ctr ?? 0) * 1000) / 10, // ratio → percent, 1dp
    position: Math.round((r.position ?? 0) * 10) / 10,
  };
}

/**
 * Totals for the trailing window + the equal preceding window, top queries for
 * the current window, and a daily clicks/impressions series for both windows.
 * Four Search Analytics calls (GSC allows one date range per call), in parallel.
 */
export async function runSearchConsoleReport(
  siteUrl: string,
  rangeDays: number,
  now: number,
): Promise<GscReport> {
  const token = await getAccessToken(now);

  const end = now - LAG_DAYS * DAY;
  const curStart = end - (rangeDays - 1) * DAY;
  const prevEnd = curStart - DAY;
  const prevStart = prevEnd - (rangeDays - 1) * DAY;

  const curRange = { startDate: ymd(curStart), endDate: ymd(end) };
  const prevRange = { startDate: ymd(prevStart), endDate: ymd(prevEnd) };

  const [totalsCur, totalsPrev, queryRows, curDaily, prevDaily] = await Promise.all([
    query(siteUrl, token, { ...curRange }),
    query(siteUrl, token, { ...prevRange }),
    query(siteUrl, token, { ...curRange, dimensions: ["query"], rowLimit: 10 }),
    query(siteUrl, token, { ...curRange, dimensions: ["date"] }),
    query(siteUrl, token, { ...prevRange, dimensions: ["date"] }),
  ]);

  const topQueries: GscQuery[] = queryRows.map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    ctr: Math.round((r.ctr ?? 0) * 1000) / 10,
    position: Math.round((r.position ?? 0) * 10) / 10,
  }));

  const toDaily = (rows: SearchAnalyticsRow[]): GscDayPoint[] =>
    rows
      .map((r) => ({
        date: r.keys?.[0] ?? "",
        clicks: Math.round(r.clicks ?? 0),
        impressions: Math.round(r.impressions ?? 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current: toTotals(totalsCur),
    prior: toTotals(totalsPrev),
    topQueries,
    daily: toDaily(curDaily),
    dailyPrev: toDaily(prevDaily),
  };
}
