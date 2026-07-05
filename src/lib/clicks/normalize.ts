// Pure raw→unified mapping for the Clicks AI-visibility report. Outputs the
// source-agnostic AiVisibility shape (not a Clicks-specific one), so the unified
// card renders Clicks with zero source knowledge. Import-light (type-only) so it
// unit-tests with node --test against the saved sample.
import type {
  AiCompetitor,
  AiEngineCitation,
  AiPromptResult,
  AiRecommendation,
  AiVisibility,
} from "@/lib/ai-visibility/types";
import type { ClicksRawReport } from "./types";

// Clicks' own bundle maps the categorical score onto the gauge as {poor:33, good:66, great:100}.
const SCORE_PCT: Record<string, number> = { poor: 33, good: 66, great: 100 };

const ENGINE_NAMES: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  ai_overview: "AI Overview",
  ai_mode: "AI Mode",
};
const ENGINE_ORDER = ["chatgpt", "perplexity", "gemini", "ai_overview", "ai_mode"];

/** A Clicks per-engine status counts as "cited" unless it's a not-cited / none state. */
export function isCited(status: string): boolean {
  const s = status.toLowerCase();
  return !(s.includes("not_cited") || s === "none" || s === "no" || s === "not_found" || s === "");
}

function humanize(status: string): string {
  const s = status.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

function mapImpact(impact: string): AiRecommendation["impact"] {
  const s = (impact || "").toLowerCase();
  if (s.startsWith("high")) return "high";
  if (s.startsWith("med")) return "medium";
  if (s.startsWith("low") || s.includes("quick")) return "low";
  return "other";
}

/** Optional Clicks sibling payloads (competitors + per-prompt results). */
export type ClicksExtras = {
  competitors?: Array<{
    name?: string;
    domain?: string | null;
    score?: number | null;
    cited?: boolean | null;
  }>;
  prompts?: Array<{
    prompt?: string;
    engine?: string | null;
    mentioned?: boolean;
    snippet?: string | null;
  }>;
};

export function normalizeClicks(
  raw: ClicksRawReport,
  extras: ClicksExtras = {},
  demo = false,
): AiVisibility {
  const breakdown = raw.llm_breakdown ?? {};
  const keys = ENGINE_ORDER.filter((k) => k in breakdown).concat(
    Object.keys(breakdown).filter((k) => !ENGINE_ORDER.includes(k)),
  );
  const engines: AiEngineCitation[] = keys.map((key) => {
    const status = breakdown[key] ?? "";
    return {
      key,
      name: ENGINE_NAMES[key] ?? humanize(key),
      cited: isCited(status),
      statusLabel: humanize(status),
    };
  });

  const label = ["poor", "good", "great"].includes(raw.visibility_score)
    ? (raw.visibility_score as "poor" | "good" | "great")
    : "unknown";

  const competitors: AiCompetitor[] = (extras.competitors ?? []).map((c) => ({
    name: c.name ?? "—",
    domain: c.domain ?? null,
    score: typeof c.score === "number" ? c.score : null,
    cited: typeof c.cited === "boolean" ? c.cited : null,
  }));

  const prompts: AiPromptResult[] = (extras.prompts ?? []).map((p) => ({
    prompt: p.prompt ?? "",
    engine: p.engine ?? null,
    mentioned: Boolean(p.mentioned),
    snippet: p.snippet ?? null,
  }));

  return {
    scoreLabel: label,
    scorePct: SCORE_PCT[raw.visibility_score] ?? null,
    explanation: raw.score_explanation ?? "",
    isNewSite: Boolean(raw.is_new_site),
    engines,
    citedCount: engines.filter((m) => m.cited).length,
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
    competitors,
    prompts,
    lastRefreshedAt: raw.last_refreshed_at ?? null,
    stale: Boolean(raw.stale),
    processing: (raw.status ?? "").toLowerCase() !== "ready",
    source: { label: "Clicks", variant: "clicks", demo },
  };
}
