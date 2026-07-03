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

export type Ga4Totals = { sessions: number; users: number; pageviews: number };
export type Ga4DailyPoint = { date: string; sessions: number }; // date = YYYY-MM-DD

type RunReportResponse = {
  error?: { message?: string };
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
};

const yyyymmdd = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
};

/**
 * One date-dimensioned report over the trailing `rangeDays` window PLUS the
 * prior window of equal length. Returns period totals for sessions / totalUsers
 * / screenPageViews (current + prior, for the trend) and a per-day sessions
 * series for the CURRENT window (feeds the trend charts).
 */
export async function runGa4Report(
  propertyId: string,
  rangeDays: number,
  now: number,
): Promise<{ current: Ga4Totals; prior: Ga4Totals; daily: Ga4DailyPoint[] }> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("GA4 service account not configured.");
  const token = await getAccessToken(sa, now);

  const body = {
    dateRanges: [{ startDate: `${rangeDays * 2}daysAgo`, endDate: "yesterday" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  };

  const res = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as RunReportResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `GA4 Data API returned ${res.status}.`);
  }

  const metricNames = (json.metricHeaders ?? []).map((h) => h.name);
  const blank = (): Ga4Totals => ({ sessions: 0, users: 0, pageviews: 0 });
  const current = blank();
  const prior = blank();
  const daily: Ga4DailyPoint[] = [];
  // Rows dated on/after this belong to the current window; earlier = prior.
  const cutoff = yyyymmdd(now - rangeDays * 86_400_000);

  for (const row of json.rows ?? []) {
    const date = row.dimensionValues?.[0]?.value ?? "";
    const isCurrent = date >= cutoff;
    const bucket = isCurrent ? current : prior;
    let sessions = 0;
    (row.metricValues ?? []).forEach((mv, i) => {
      const n = Number(mv.value);
      const value = Number.isFinite(n) ? n : 0;
      const name = metricNames[i];
      if (name === "sessions") {
        bucket.sessions += value;
        sessions = value;
      } else if (name === "totalUsers") bucket.users += value;
      else if (name === "screenPageViews") bucket.pageviews += value;
    });
    if (isCurrent && date.length === 8) {
      daily.push({
        date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
        sessions,
      });
    }
  }

  return { current, prior, daily };
}
