import type {
  CoreWebVitals,
  LighthouseCategories,
  PageSpeedData,
  PageSpeedStrategyData,
  ServiceResult,
} from "./types";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const TIMEOUT_MS = 30_000;
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

type LighthouseAudit = { numericValue?: number };
type PsiResponse = {
  error?: { message?: string };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, LighthouseAudit>;
  };
  loadingExperience?: { metrics?: { INTERACTION_TO_NEXT_PAINT?: { percentile?: number } } };
  originLoadingExperience?: { metrics?: { INTERACTION_TO_NEXT_PAINT?: { percentile?: number } } };
};

const pct = (score: number | null | undefined): number | null =>
  typeof score === "number" ? Math.round(score * 100) : null;

/** Run PSI for one strategy, returning the four category scores + CWV. */
async function runStrategy(
  url: string,
  strategy: "desktop" | "mobile",
  key: string | undefined,
): Promise<ServiceResult<PageSpeedStrategyData>> {
  const params = new URLSearchParams({ url, strategy });
  for (const c of CATEGORIES) params.append("category", c);
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
      return { ok: false, error: json.error?.message ?? `PageSpeed API returned ${res.status}` };
    }
    const lh = json.lighthouseResult;
    if (!lh) return { ok: false, error: "PageSpeed returned no Lighthouse result." };

    const cats = lh.categories ?? {};
    const categories: LighthouseCategories = {
      performance: pct(cats.performance?.score),
      accessibility: pct(cats.accessibility?.score),
      best_practices: pct(cats["best-practices"]?.score),
      seo: pct(cats.seo?.score),
    };

    const audits = lh.audits ?? {};
    const num = (id: string): number | null => {
      const v = audits[id]?.numericValue;
      return typeof v === "number" ? Math.round(v) : null;
    };
    const clsRaw = audits["cumulative-layout-shift"]?.numericValue;
    const inpField =
      json.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
      json.originLoadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile ??
      null;

    const cwv: CoreWebVitals = {
      lcp_ms: num("largest-contentful-paint"),
      cls: typeof clsRaw === "number" ? Math.round(clsRaw * 1000) / 1000 : null,
      inp_ms: typeof inpField === "number" ? Math.round(inpField) : null,
      fcp_ms: num("first-contentful-paint"),
      tbt_ms: num("total-blocking-time"),
    };

    return { ok: true, data: { categories, cwv } };
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

/**
 * Google PageSpeed Insights v5 for BOTH desktop and mobile, capturing all four
 * Lighthouse categories (performance, accessibility, best practices, SEO) plus
 * lab Core Web Vitals. The two strategy calls run in parallel. Succeeds if at
 * least one strategy returns; the missing strategy is null.
 */
export async function runPageSpeed(url: string): Promise<ServiceResult<PageSpeedData>> {
  const key = process.env.PAGESPEED_API_KEY;
  const [desktop, mobile] = await Promise.all([
    runStrategy(url, "desktop", key),
    runStrategy(url, "mobile", key),
  ]);

  if (!desktop.ok && !mobile.ok) {
    return { ok: false, error: mobile.error };
  }
  return {
    ok: true,
    data: {
      desktop: desktop.ok ? desktop.data : null,
      mobile: mobile.ok ? mobile.data : null,
      keyed: Boolean(key),
    },
  };
}
