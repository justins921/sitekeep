import type { CoreWebVitals, PageSpeedData, PageSpeedStrategyData } from "./types";

/** Normalize legacy single-strategy PageSpeed snapshots into the new shape. */
export function normalizePageSpeed(raw: unknown): PageSpeedData {
  const d = raw as Record<string, unknown> | null;
  if (d && (d.desktop || d.mobile)) return raw as PageSpeedData;
  const legacy = (d ?? {}) as { performance_score?: number | null } & Partial<CoreWebVitals>;
  const strat: PageSpeedStrategyData = {
    categories: {
      performance: legacy.performance_score ?? null,
      accessibility: null,
      best_practices: null,
      seo: null,
    },
    cwv: {
      lcp_ms: legacy.lcp_ms ?? null,
      cls: legacy.cls ?? null,
      inp_ms: legacy.inp_ms ?? null,
      fcp_ms: legacy.fcp_ms ?? null,
      tbt_ms: legacy.tbt_ms ?? null,
    },
  };
  return { desktop: null, mobile: strat, keyed: false };
}
