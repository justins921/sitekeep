import tls from "node:tls";
import type { SecurityData, SecurityGrade, SecurityRisk, ServiceResult } from "./types";

const SAFE_BROWSING_ENDPOINT = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

const FETCH_TIMEOUT_MS = 15_000;
const TLS_TIMEOUT_MS = 10_000;

export type CertInfo = {
  valid: boolean;
  validTo: string | null;
  daysToExpiry: number | null;
  issuer: string | null;
};

/** Inspect the TLS certificate directly for validity + days-to-expiry. */
export function inspectCertificate(host: string): Promise<CertInfo> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (info: CertInfo) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve(info);
    };

    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: TLS_TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          return done({ valid: false, validTo: null, daysToExpiry: null, issuer: null });
        }
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const daysToExpiry = validTo
          ? Math.round((validTo.getTime() - Date.now()) / 86_400_000)
          : null;
        const rawIssuer = cert.issuer?.O ?? cert.issuer?.CN ?? null;
        const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] ?? null : rawIssuer;
        done({
          valid: socket.authorized,
          validTo: validTo ? validTo.toISOString() : null,
          daysToExpiry,
          issuer,
        });
      },
    );

    socket.on("error", () =>
      done({ valid: false, validTo: null, daysToExpiry: null, issuer: null }),
    );
    socket.on("timeout", () =>
      done({ valid: false, validTo: null, daysToExpiry: null, issuer: null }),
    );
  });
}

async function fetchWithTimeout(url: string, redirect: RequestRedirect) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      redirect,
      signal: controller.signal,
      headers: { "user-agent": "SiteKeepBot/1.0 (+https://sitekeep.com)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

type SecurityBase = Omit<SecurityData, "grade" | "risk_level" | "safe_browsing">;

function headerScore(d: SecurityBase): number {
  const h = d.headers;
  return (
    Number(h.hsts) +
    Number(h.csp) +
    Number(h.x_frame_options) +
    Number(h.x_content_type_options) +
    Number(h.referrer_policy)
  );
}

function grade(d: SecurityBase): SecurityGrade {
  if (!d.https_enforced || !d.ssl_valid) return "fail";
  if (d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 14) return "fail";
  const expirySoon = d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 30;
  if (headerScore(d) >= 4 && !expirySoon) return "pass";
  return "warn";
}

/** Minimal→Critical risk from real SSL + header findings (+ Safe Browsing). */
function riskLevel(d: SecurityBase, threats: number): SecurityRisk {
  if (threats > 0) return "critical";
  if (!d.ssl_valid || !d.https_enforced) return "high";
  let points = 5 - headerScore(d); // 0 (all present) .. 5 (none)
  if (d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 14) points += 2;
  else if (d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 30) points += 1;
  if (points === 0) return "minimal";
  if (points <= 1) return "low";
  if (points <= 3) return "medium";
  if (points <= 5) return "high";
  return "critical";
}

/**
 * Real Google Safe Browsing lookup — ONLY when SAFE_BROWSING_API_KEY is set.
 * Returns null otherwise so the UI omits the malware/blacklist tiles entirely
 * (never a fabricated "no malware found").
 */
async function checkSafeBrowsing(url: string): Promise<{ checked: boolean; threats: string[] } | null> {
  const key = process.env.SAFE_BROWSING_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${SAFE_BROWSING_ENDPOINT}?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "sitekeep", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!res.ok) return { checked: false, threats: [] };
    const json = (await res.json()) as { matches?: Array<{ threatType?: string }> };
    const threats = (json.matches ?? []).map((m) => m.threatType ?? "THREAT");
    return { checked: true, threats };
  } catch {
    return { checked: false, threats: [] };
  }
}

/**
 * Real security check with no paid API: verifies HTTPS is enforced, inspects the
 * TLS certificate (validity + days-to-expiry), and records the key security
 * response headers, rolled into a pass/warn/fail grade.
 */
export async function runSecurity(
  url: string,
): Promise<ServiceResult<SecurityData>> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  try {
    // Primary request over HTTPS (follow redirects) for headers + reachability.
    const httpsUrl = `https://${host}${new URL(url).pathname}`;
    const res = await fetchWithTimeout(httpsUrl, "follow");

    // A successful HTTPS fetch means the cert chain validated.
    const fetchValidatedTls = res.ok || (res.status >= 300 && res.status < 500);

    const header = (name: string) => res.headers.get(name) !== null;
    const headers = {
      hsts: header("strict-transport-security"),
      csp: header("content-security-policy"),
      x_frame_options: header("x-frame-options"),
      x_content_type_options: header("x-content-type-options"),
      referrer_policy: header("referrer-policy"),
    };

    // Does plain HTTP redirect to HTTPS?
    let https_enforced = headers.hsts; // HSTS implies enforcement
    try {
      const httpRes = await fetchWithTimeout(`http://${host}`, "follow");
      if (httpRes.url.startsWith("https://")) https_enforced = true;
    } catch {
      // If HTTP is refused entirely, treat HTTPS-only as enforced.
      https_enforced = https_enforced || fetchValidatedTls;
    }

    const [cert, safe_browsing] = await Promise.all([
      inspectCertificate(host),
      checkSafeBrowsing(res.url || httpsUrl),
    ]);
    const ssl_valid = cert.valid || fetchValidatedTls;

    const base: SecurityBase = {
      final_url: res.url || httpsUrl,
      https_enforced,
      ssl_valid,
      ssl_days_to_expiry: cert.daysToExpiry,
      ssl_valid_to: cert.validTo,
      cert_issuer: cert.issuer,
      headers,
    };

    return {
      ok: true,
      data: {
        ...base,
        grade: grade(base),
        risk_level: riskLevel(base, safe_browsing?.threats.length ?? 0),
        safe_browsing,
      },
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "The site did not respond in time."
        : err instanceof Error
          ? `Could not reach the site: ${err.message}`
          : "Security check failed.";
    return { ok: false, error: msg };
  }
}
