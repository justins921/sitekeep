import type { PageSpeedData, ServiceResult } from "./types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 30_000;

type LighthouseAudit = { numericValue?: number };
type PsiResponse = {
  error?: { message?: string };
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, LighthouseAudit>;
  };
  loadingExperience?: {
    metrics?: {
      INTERACTION_TO_NEXT_PAINT?: { percentile?: number };
    };
  };
  originLoadingExperience?: {
    metrics?: {
      INTERACTION_TO_NEXT_PAINT?: { percentile?: number };
    };
  };
};

/**
 * Runs Google PageSpeed Insights v5 (mobile). Works keyless at low volume;
 * uses PAGESPEED_API_KEY for higher quota when present. Returns performance
 * score + lab Core Web Vitals; INP comes from CrUX field data when available
 * (Lighthouse does not measure INP on a single cold load), else null.
 */
export async function runPageSpeed(
  url: string,
): Promise<ServiceResult<PageSpeedData>> {
  const key = process.env.PAGESPEED_API_KEY;
  const params = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
  if (key) params.set("key", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PSI_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });

    const json = (await res.json()) as PsiResponse;

    if (!res.ok || json.error) {
      return {
        ok: false,
        error: json.error?.message ?? `PageSpeed API returned ${res.status}`,
      };
    }

    const lh = json.lighthouseResult;
    if (!lh) return { ok: false, error: "PageSpeed returned no Lighthouse result." };

    const audits = lh.audits ?? {};
    const num = (id: string): number | null => {
      const v = audits[id]?.numericValue;
      return typeof v === "number" ? Math.round(v) : null;
    };

    const scoreRaw = lh.categories?.performance?.score;
    const performance_score =
      typeof scoreRaw === "number" ? Math.round(scoreRaw * 100) : null;

    const clsRaw = audits["cumulative-layout-shift"]?.numericValue;
    const cls = typeof clsRaw === "number" ? Math.round(clsRaw * 1000) / 1000 : null;

    const inpField =
      json.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
      json.originLoadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
      null;

    return {
      ok: true,
      data: {
        strategy: "mobile",
        performance_score,
        lcp_ms: num("largest-contentful-paint"),
        cls,
        inp_ms: typeof inpField === "number" ? Math.round(inpField) : null,
        fcp_ms: num("first-contentful-paint"),
        tbt_ms: num("total-blocking-time"),
        keyed: Boolean(key),
      },
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "PageSpeed timed out — the site was too slow to analyze."
        : err instanceof Error
          ? err.message
          : "PageSpeed request failed.";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
