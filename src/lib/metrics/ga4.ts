// NOTE: no "server-only" here — the PURE helpers (parseServiceAccount,
// normalizeGa4PropertyId, ga4SourceFor) are unit-tested outside Next. The
// network/crypto paths still only ever run server-side (they're only called by
// the traffic provider, which runs in server actions / cron).
import { createSign } from "node:crypto";

/**
 * Minimal Google Analytics 4 Data API client authenticated with a SERVICE
 * ACCOUNT — the agency shares each client's GA4 property with the service
 * account email (Viewer), so there's no per-client OAuth. Server-to-server only.
 *
 * We hand-sign the OAuth2 JWT (RS256) with Node's crypto and exchange it for a
 * short-lived access token — equivalent to a BetaAnalyticsDataClient runReport
 * but with zero dependencies (no google-auth-library / gRPC), which keeps the
 * serverless bundle lean and matches the implementation already verified live.
 *
 * Credentials: GA4_SERVICE_ACCOUNT_KEY (base64-encoded JSON — recommended, since
 * base64 survives the private_key's newlines) OR GA4_SERVICE_ACCOUNT_JSON (raw
 * JSON). Never logged or exposed; server-side only.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

let credsCache: ServiceAccount | null | undefined;

/**
 * Parse a service-account credential from a raw env value. Accepts either raw
 * JSON (`{ ... }`) or base64-encoded JSON. Pure + side-effect free so it can be
 * unit-tested. Returns null when absent or malformed.
 */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw) return null;
  let text = raw.trim();
  // If it isn't already JSON, treat it as base64-encoded JSON.
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      // Support keys stored with escaped newlines (\n) as well as real ones.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
      token_uri: parsed.token_uri || DEFAULT_TOKEN_URI,
    };
  } catch {
    return null;
  }
}

/** Parse (once) the service account from the environment. */
export function getServiceAccount(): ServiceAccount | null {
  if (credsCache !== undefined) return credsCache;
  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY ?? process.env.GA4_SERVICE_ACCOUNT_JSON;
  return (credsCache = parseServiceAccount(raw));
}

/** Is GA4 configured at all? Lets the provider fall back to demo data cleanly. */
export function ga4Configured(): boolean {
  return getServiceAccount() !== null;
}

/**
 * GA4 property IDs are numeric (e.g. 123456789). Accept whatever the agency
 * pasted — "properties/123", "123", stray spaces — and return the digits, or
 * null if there aren't any (e.g. they pasted a "G-XXXX" measurement id).
 */
export function normalizeGa4PropertyId(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^0-9]/g, "");
  return digits.length ? digits : null;
}

/**
 * Pure selector: use REAL GA4 only when credentials are configured AND the
 * client has a usable (numeric) property id; otherwise the labeled demo stub.
 */
export function ga4SourceFor(
  hasCredentials: boolean,
  propertyId: string | null | undefined,
): "real" | "stub" {
  return hasCredentials && normalizeGa4PropertyId(propertyId) ? "real" : "stub";
}

const base64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Cache access tokens per service-account email until ~60s before expiry.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(sa: ServiceAccount, now: number): Promise<string> {
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > now + 60_000) return cached.token;

  const iat = Math.floor(now / 1000);
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri,
    iat,
    exp: iat + 3600,
  };
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
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Token exchange failed (${res.status}).`);
  }
  tokenCache.set(sa.client_email, {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

export type Ga4Metrics = {
  users: number; // activeUsers
  newUsers: number;
  sessions: number;
  pageviews: number; // screenPageViews
  engagementRate: number; // percent 0–100
  avgEngagementTime: number; // seconds per active user
};
export type Ga4DayPoint = { date: string; users: number; newUsers: number; sessions: number };
export type Ga4Report = {
  current: Ga4Metrics;
  prior: Ga4Metrics;
  daily: Ga4DayPoint[]; // current window, per day
  dailyPrev: Ga4DayPoint[]; // preceding window, per day
};

type RunReportResponse = {
  error?: { message?: string };
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
};

const TOTAL_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "screenPageViews",
  "engagementRate",
  "userEngagementDuration",
] as const;
const SERIES_METRICS = ["activeUsers", "newUsers", "sessions"] as const;

async function ga4Fetch(propertyId: string, token: string, body: unknown): Promise<RunReportResponse> {
  const res = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as RunReportResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `GA4 Data API returned ${res.status}.`);
  }
  return json;
}

const isoDate = (yyyymmdd: string) =>
  yyyymmdd.length === 8
    ? `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
    : yyyymmdd;

/**
 * Two reports over the trailing `rangeDays` window AND the equal preceding
 * window: (1) period totals for engagement + user/session metrics (accurate
 * aggregate rates), and (2) a per-day series (activeUsers / newUsers / sessions)
 * for both windows to draw the comparison line chart.
 */
export async function runGa4Report(
  propertyId: string,
  rangeDays: number,
  now: number,
): Promise<Ga4Report> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("GA4 service account not configured.");
  const token = await getAccessToken(sa, now);

  const dateRanges = [
    { startDate: `${rangeDays}daysAgo`, endDate: "yesterday" },
    { startDate: `${rangeDays * 2}daysAgo`, endDate: `${rangeDays + 1}daysAgo` },
  ];

  const [totals, series] = await Promise.all([
    ga4Fetch(propertyId, token, {
      dateRanges,
      metrics: TOTAL_METRICS.map((name) => ({ name })),
    }),
    ga4Fetch(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: SERIES_METRICS.map((name) => ({ name })),
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
  ]);

  // ---- totals (rows tagged date_range_0 = current, date_range_1 = prior) ----
  const tNames = (totals.metricHeaders ?? []).map((h) => h.name);
  const tDr = (totals.dimensionHeaders ?? []).findIndex((h) => h.name === "dateRange");
  const readMetrics = (row: NonNullable<RunReportResponse["rows"]>[number]) => {
    const get = (name: string) => {
      const i = tNames.indexOf(name);
      const n = Number(row.metricValues?.[i]?.value);
      return Number.isFinite(n) ? n : 0;
    };
    const users = get("activeUsers");
    const engDuration = get("userEngagementDuration");
    return {
      users,
      newUsers: get("newUsers"),
      sessions: get("sessions"),
      pageviews: get("screenPageViews"),
      engagementRate: Math.round(get("engagementRate") * 1000) / 10, // ratio → %
      avgEngagementTime: users > 0 ? Math.round(engDuration / users) : 0,
    } as Ga4Metrics;
  };
  const blank: Ga4Metrics = { users: 0, newUsers: 0, sessions: 0, pageviews: 0, engagementRate: 0, avgEngagementTime: 0 };
  let current = blank;
  let prior = blank;
  for (const row of totals.rows ?? []) {
    const tag = tDr >= 0 ? row.dimensionValues?.[tDr]?.value : "date_range_0";
    if (tag === "date_range_1") prior = readMetrics(row);
    else current = readMetrics(row);
  }

  // ---- daily series (dimensions: date + dateRange) ----
  const sNames = (series.metricHeaders ?? []).map((h) => h.name);
  const sDate = (series.dimensionHeaders ?? []).findIndex((h) => h.name === "date");
  const sDr = (series.dimensionHeaders ?? []).findIndex((h) => h.name === "dateRange");
  const daily: Ga4DayPoint[] = [];
  const dailyPrev: Ga4DayPoint[] = [];
  const metric = (row: NonNullable<RunReportResponse["rows"]>[number], name: string) => {
    const i = sNames.indexOf(name);
    const n = Number(row.metricValues?.[i]?.value);
    return Number.isFinite(n) ? n : 0;
  };
  for (const row of series.rows ?? []) {
    const date = isoDate(sDate >= 0 ? row.dimensionValues?.[sDate]?.value ?? "" : "");
    const tag = sDr >= 0 ? row.dimensionValues?.[sDr]?.value : "date_range_0";
    const point: Ga4DayPoint = {
      date,
      users: metric(row, "activeUsers"),
      newUsers: metric(row, "newUsers"),
      sessions: metric(row, "sessions"),
    };
    (tag === "date_range_1" ? dailyPrev : daily).push(point);
  }
  daily.sort((a, b) => a.date.localeCompare(b.date));
  dailyPrev.sort((a, b) => a.date.localeCompare(b.date));

  return { current, prior, daily, dailyPrev };
}
