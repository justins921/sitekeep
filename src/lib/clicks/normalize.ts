// Pure raw→normalized mapping for the Clicks AI-visibility report. Import-light
// (type-only imports) so it can be unit-tested with node --test against the saved
// sample, no bundler or network.
import type {
  ClicksAiVisibility,
  ClicksModelCitation,
  ClicksRawReport,
  ClicksRecommendation,
} from "./types";

// Clicks' own bundle maps the categorical score onto the gauge as {poor:33, good:66, great:100}.
const SCORE_PCT: Record<string, number> = { poor: 33, good: 66, great: 100 };

const MODEL_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  ai_overview: "AI Overview",
  ai_mode: "AI Mode",
};
const MODEL_ORDER = ["chatgpt", "perplexity", "gemini", "ai_overview", "ai_mode"];

/** A Clicks per-model status counts as "cited" unless it's a not-cited / none state. */
export function isCited(status: string): boolean {
  const s = status.toLowerCase();
  return !(s.includes("not_cited") || s === "none" || s === "no" || s === "not_found" || s === "");
}

function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

function mapImpact(impact: string): ClicksRecommendation["impact"] {
  const s = (impact || "").toLowerCase();
  if (s.startsWith("high")) return "high";
  if (s.startsWith("med")) return "medium";
  if (s.startsWith("low") || s.includes("quick")) return "low";
  return "other";
}

export function normalizeClicks(raw: ClicksRawReport): ClicksAiVisibility {
  const breakdown = raw.llm_breakdown ?? {};
  const keys = MODEL_ORDER.filter((k) => k in breakdown).concat(
    Object.keys(breakdown).filter((k) => !MODEL_ORDER.includes(k)),
  );
  const models: ClicksModelCitation[] = keys.map((key) => {
    const status = breakdown[key] ?? "";
    return {
      key,
      name: MODEL_NAMES[key] ?? humanizeStatus(key),
      cited: isCited(status),
      statusLabel: humanizeStatus(status),
    };
  });

  const label = ["poor", "good", "great"].includes(raw.visibility_score)
    ? (raw.visibility_score as "poor" | "good" | "great")
    : "unknown";

  return {
    scoreLabel: label,
    scorePct: SCORE_PCT[raw.visibility_score] ?? null,
    explanation: raw.score_explanation ?? "",
    isNewSite: Boolean(raw.is_new_site),
    models,
    citedCount: models.filter((m) => m.cited).length,
    whatsWorking: (raw.whats_working ?? []).map((w) => ({ title: w.title, detail: w.detail })),
    holdingBack: (raw.holding_back ?? []).map((h) => ({ title: h.title, detail: h.detail })),
    keywordThemes: (raw.keyword_footprint ?? []).map((k) => ({
      label: k.label,
      keywords: k.keywords ?? [],
    })),
    recommendations: (raw.recommendations ?? []).map((r) => ({
      title: r.title,
      detail: r.description,
      impact: mapImpact(r.impact),
    })),
    lastRefreshedAt: raw.last_refreshed_at ?? null,
    stale: Boolean(raw.stale),
    processing: (raw.status ?? "").toLowerCase() !== "ready",
  };
}
