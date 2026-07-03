import "server-only";
import { createSign } from "node:crypto";

/**
 * Minimal Google Analytics 4 Data API client authenticated with a SERVICE
 * ACCOUNT — the agency shares each client's GA4 property with the service
 * account email (Viewer), so there's no per-client OAuth. Server-to-server only.
 *
 * We hand-sign the OAuth2 JWT (RS256) with Node's crypto and exchange it for a
 * short-lived access token, rather than pulling in google-auth-library. The
 * token is cached in-module until shortly before it expires.
 *
 * Credentials come from GA4_SERVICE_ACCOUNT_JSON (the full service-account key
 * file, pasted verbatim as one env var).
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

/** Parse (once) the service-account JSON from the environment. */
export function getServiceAccount(): ServiceAccount | null {
  if (credsCache !== undefined) return credsCache;
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return (credsCache = null);
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return (credsCache = null);
    // Support keys stored with escaped newlines (\n) as well as real ones.
    const private_key = parsed.private_key.replace(/\\n/g, "\n");
    return (credsCache = {
      client_email: parsed.client_email,
      private_key,
      token_uri: parsed.token_uri || DEFAULT_TOKEN_URI,
    });
  } catch {
    return (credsCache = null);
  }
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

type RunReportResponse = {
  error?: { message?: string };
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
};

/**
 * Run one report covering the trailing `rangeDays` window AND the prior window
 * of the same length, so the caller can compute a period-over-period trend.
 * Returns totals for [current, prior].
 */
export async function runGa4Report(
  propertyId: string,
  rangeDays: number,
  now: number,
): Promise<{ current: Ga4Totals; prior: Ga4Totals }> {
  const sa = getServiceAccount();
  if (!sa) throw new Error("GA4 service account not configured.");
  const token = await getAccessToken(sa, now);

  const body = {
    dateRanges: [
      { startDate: `${rangeDays}daysAgo`, endDate: "yesterday" },
      { startDate: `${rangeDays * 2}daysAgo`, endDate: `${rangeDays + 1}daysAgo` },
    ],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "screenPageViews" }],
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

  // With multiple date ranges and no dimensions, GA4 tags each row with a
  // synthetic "dateRange" dimension valued "date_range_0" / "date_range_1".
  const drIndex = (json.dimensionHeaders ?? []).findIndex((h) => h.name === "dateRange");
  const metricNames = (json.metricHeaders ?? []).map((h) => h.name);
  const blank = (): Ga4Totals => ({ sessions: 0, users: 0, pageviews: 0 });
  const totals: Ga4Totals[] = [blank(), blank()];

  for (const row of json.rows ?? []) {
    const tag = drIndex >= 0 ? row.dimensionValues?.[drIndex]?.value : "date_range_0";
    const slot = tag === "date_range_1" ? 1 : 0;
    (row.metricValues ?? []).forEach((mv, i) => {
      const n = Number(mv.value);
      const value = Number.isFinite(n) ? n : 0;
      const name = metricNames[i];
      if (name === "sessions") totals[slot].sessions += value;
      else if (name === "totalUsers") totals[slot].users += value;
      else if (name === "screenPageViews") totals[slot].pageviews += value;
    });
  }

  return { current: totals[0], prior: totals[1] };
}
