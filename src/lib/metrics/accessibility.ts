import { getPsi } from "./pagespeed";
import { parseAccessibility } from "./accessibility-parse";
import type { AccessibilityData, ServiceResult } from "./types";

/**
 * Accessibility (WCAG) scan. Reuses the SAME Lighthouse/PSI response as Page
 * Speed (shared via the getPsi cache) — no extra API, no headless browser — and
 * parses the accessibility category into passed/failed audits. Mobile strategy,
 * matching how the marketing/health scoring already treats the page.
 */
export async function runAccessibility(url: string): Promise<ServiceResult<AccessibilityData>> {
  const key = process.env.PAGESPEED_API_KEY;
  try {
    const json = await getPsi(url, "mobile", key);
    return { ok: true, data: parseAccessibility(json.lighthouseResult!, "mobile") };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accessibility scan failed.",
    };
  }
}
