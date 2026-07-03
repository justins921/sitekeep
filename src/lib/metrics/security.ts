import tls from "node:tls";
import type { SecurityData, SecurityGrade, ServiceResult } from "./types";

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

function grade(d: Omit<SecurityData, "grade">): SecurityGrade {
  if (!d.https_enforced || !d.ssl_valid) return "fail";
  if (d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 14) return "fail";

  const h = d.headers;
  const headerScore =
    Number(h.hsts) +
    Number(h.csp) +
    Number(h.x_frame_options) +
    Number(h.x_content_type_options) +
    Number(h.referrer_policy);

  const expirySoon = d.ssl_days_to_expiry !== null && d.ssl_days_to_expiry < 30;
  if (headerScore >= 4 && !expirySoon) return "pass";
  return "warn";
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

    const cert = await inspectCertificate(host);
    const ssl_valid = cert.valid || fetchValidatedTls;

    const base: Omit<SecurityData, "grade"> = {
      final_url: res.url || httpsUrl,
      https_enforced,
      ssl_valid,
      ssl_days_to_expiry: cert.daysToExpiry,
      ssl_valid_to: cert.validTo,
      cert_issuer: cert.issuer,
      headers,
    };

    return { ok: true, data: { ...base, grade: grade(base) } };
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
