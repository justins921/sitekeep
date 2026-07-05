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

export type Strategy = "desktop" | "mobile";

// The full Lighthouse shape we read — category scores + auditRefs (which audits
// belong to a category, with group + weight), category-group titles, and the
// per-audit results (title, description, score, details.items). The accessibility
// provider reads the SAME response, so nothing extra is fetched.
export type LhAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  numericValue?: number;
  details?: { items?: unknown[] };
};
export type LhAuditRef = { id: string; weight: number; group?: string; acronym?: string };
export type PsiResponse = {
  error?: { message?: string };
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null; auditRefs?: LhAuditRef[] }>;
    categoryGroups?: Record<string, { title?: string; description?: string }>;
    audits?: Record<string, LhAudit>;
  };
  loadingExperience?: { metrics?: { INTERACTION_TO_NEXT_PAINT?: { percentile?: number } } };
  originLoadingExperience?: { metrics?: { INTERACTION_TO_NEXT_PAINT?: { percentile?: number } } };
};

const pct = (score: number | null | undefined): number | null =>
  typeof score === "number" ? Math.round(score * 100) : null;

// Short-lived in-flight + result cache keyed by strategy+url, so a single refresh
// where BOTH Page Speed and Accessibility are enabled shares one PSI fetch per
// strategy instead of calling the API twice for the same page.
const CACHE_TTL_MS = 120_000;
const psiCache = new Map<string, { at: number; p: Promise<PsiResponse> }>();

/** Fetch (or reuse) the raw PSI/Lighthouse response for a URL + strategy. */
export function getPsi(
  url: string,
  strategy: Strategy,
  key: string | undefined,
): Promise<PsiResponse> {
  const cacheKey = `${strategy}|${url}`;
  const hit = psiCache.get(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.p;

  const p = fetchPsi(url, strategy, key);
  psiCache.set(cacheKey, { at: now, p });
  // Evict a rejected/errored fetch so the next refresh retries cleanly.
  p.catch(() => {
    if (psiCache.get(cacheKey)?.p === p) psiCache.delete(cacheKey);
  });
  return p;
}

async function fetchPsi(url: string, strategy: Strategy, key: string | undefined): Promise<PsiResponse> {
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
      throw new Error(json.error?.message ?? `PageSpeed API returned ${res.status}`);
    }
    if (!json.lighthouseResult) throw new Error("PageSpeed returned no Lighthouse result.");
    return json;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("PageSpeed timed out — the site was too slow to analyze.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Build the page-speed category scores + CWV for one strategy. */
async function runStrategy(
  url: string,
  strategy: Strategy,
  key: string | undefined,
): Promise<ServiceResult<PageSpeedStrategyData>> {
  try {
    const json = await getPsi(url, strategy, key);
    const lh = json.lighthouseResult!;
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
    return { ok: false, error: err instanceof Error ? err.message : "PageSpeed request failed." };
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
