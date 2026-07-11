import "server-only";
import { pingUrl } from "@/lib/uptime";
import { inspectCertificate } from "@/lib/metrics/security";
import { runPageSpeed } from "@/lib/metrics/pagespeed";
import {
  computeKeepScore,
  KEEP_DIMENSION_LABELS,
  type KeepInputs,
} from "@/lib/keep-score/score";
import {
  normalizeUptime,
  normalizePerformance,
  normalizeSslDomain,
  normalizeLinks,
} from "@/lib/keep-score/normalize";
import type { ScanCheck, ScanResult } from "./types";

// Anonymous scan powering scan-first onboarding. Reuses the same providers as
// the authed monitoring path (uptime ping, TLS cert, PageSpeed) plus a light
// broken-links sample, then runs the REAL Keep Score engine — so the number a
// visitor sees before signup is the number they'll see after. No DB writes; no
// form-delivery dimension (that needs a configured form, so it's redistributed).

const LINKS_TIMEOUT_MS = 8_000;
const LINKS_SAMPLE = 8;

/** Fetch the homepage HTML once (shared by links sampling). Null if unreachable. */
async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINKS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "SiteKeepBot/1.0 (+https://sitekeep.com)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Sample same-origin links from the homepage; return share returning 2xx/3xx. */
async function sampleBrokenLinks(
  url: string,
  html: string | null,
): Promise<{ okPct: number | null; broken: number; checked: number }> {
  if (!html) return { okPct: null, broken: 0, checked: 0 };
  const origin = new URL(url).origin;
  const hrefs = new Set<string>();
  const re = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hrefs.size < 40) {
    try {
      const abs = new URL(m[1], url);
      if (abs.origin === origin && /^https?:$/.test(abs.protocol)) {
        hrefs.add(abs.toString());
      }
    } catch {
      // ignore unparseable hrefs
    }
  }
  const sample = [...hrefs].slice(0, LINKS_SAMPLE);
  if (sample.length === 0) return { okPct: null, broken: 0, checked: 0 };

  const results = await Promise.all(
    sample.map(async (href) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LINKS_TIMEOUT_MS);
      try {
        const res = await fetch(href, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "SiteKeepBot/1.0 (+https://sitekeep.com)" },
        });
        return res.status < 400;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  const ok = results.filter(Boolean).length;
  const broken = results.length - ok;
  return { okPct: (ok / results.length) * 100, broken, checked: results.length };
}

function statusFor(subscore: number | null): ScanCheck["status"] {
  if (subscore == null) return "skipped";
  if (subscore >= 90) return "good";
  if (subscore >= 70) return "warn";
  return "bad";
}

/** Run the full anonymous scan for a normalized URL. */
export async function runScan(url: string): Promise<ScanResult> {
  const host = new URL(url).hostname;
  const scannedAt = new Date().toISOString();

  // Kick everything off in parallel — PageSpeed is the slow one (~10–30s).
  const html = await fetchHtml(url);
  const [ping, cert, psi, links] = await Promise.all([
    pingUrl(url),
    inspectCertificate(host),
    runPageSpeed(url),
    sampleBrokenLinks(url, html),
  ]);

  const unreachable = !ping.is_up;

  // Uptime sub-score: a single live ping is up (100) or down (0).
  const uptimeSub = normalizeUptime(ping.is_up ? 100 : 0);

  // Performance: prefer mobile Lighthouse performance, fall back to desktop.
  const perfRaw = psi.ok
    ? (psi.data.mobile?.categories.performance ?? psi.data.desktop?.categories.performance ?? null)
    : null;
  const perfSub = normalizePerformance(perfRaw);

  const sslSub = normalizeSslDomain({
    sslValid: cert.valid,
    sslDaysToExpiry: cert.daysToExpiry,
    domainDaysToExpiry: null, // whois not part of the anonymous scan
  });

  const linksSub = normalizeLinks(links.okPct);

  const inputs: KeepInputs = {
    uptime: uptimeSub,
    performance: perfSub,
    ssl_domain: sslSub,
    links: linksSub,
    // form intentionally omitted — redistributes to uptime.
  };
  const { score } = computeKeepScore(inputs);

  const checks: ScanCheck[] = [
    {
      dimension: "uptime",
      label: KEEP_DIMENSION_LABELS.uptime,
      subscore: uptimeSub,
      status: statusFor(uptimeSub),
      detail: ping.is_up
        ? `Responded in ${ping.response_ms ?? "—"} ms${ping.status_code ? ` (HTTP ${ping.status_code})` : ""}`
        : "The site didn't respond to our request",
      insight: ping.is_up ? undefined : "Your visitors may be seeing the same failure right now.",
    },
    {
      dimension: "performance",
      label: KEEP_DIMENSION_LABELS.performance,
      subscore: perfSub,
      status: statusFor(perfSub),
      detail:
        perfSub == null
          ? "Speed test unavailable for this scan"
          : `Lighthouse performance ${perfSub}/100 on mobile`,
      insight:
        perfSub != null && perfSub < 90
          ? "Slow pages cost conversions — worth a performance pass."
          : undefined,
    },
    {
      dimension: "ssl_domain",
      label: KEEP_DIMENSION_LABELS.ssl_domain,
      subscore: sslSub,
      status: statusFor(sslSub),
      detail: !cert.valid
        ? "The SSL certificate is invalid or missing"
        : cert.daysToExpiry != null
          ? `Certificate valid, ${cert.daysToExpiry} days to renewal`
          : "Certificate valid",
      insight: !cert.valid
        ? "Browsers may warn visitors that the site isn't secure."
        : cert.daysToExpiry != null && cert.daysToExpiry < 14
          ? "The certificate renews soon — a lapse would take the site offline."
          : undefined,
    },
    {
      dimension: "links",
      label: KEEP_DIMENSION_LABELS.links,
      subscore: linksSub,
      status: statusFor(linksSub),
      detail:
        linksSub == null
          ? "No internal links found to check"
          : links.broken === 0
            ? `All ${links.checked} sampled links resolved`
            : `${links.broken} of ${links.checked} sampled links are broken`,
      insight:
        links.broken > 0
          ? "Broken links frustrate visitors and hurt search ranking."
          : undefined,
    },
  ];

  return { url, host, scannedAt, score, checks, unreachable };
}
