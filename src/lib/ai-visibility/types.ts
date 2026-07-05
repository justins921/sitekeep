// ─────────────────────────────────────────────────────────────────────────────
// AI Visibility — ONE normalized shape that every source (Clicks, standalone LLM
// pipeline, …) maps into. The card renders this and only this; providers differ
// only in how they fill it. Flag-gated via getFeature(agency,'ai_visibility').
// ─────────────────────────────────────────────────────────────────────────────

export type AiScoreLabel = "poor" | "good" | "great" | "unknown";

/** One AI engine's citation status (chatgpt/perplexity/gemini/ai_overview/ai_mode). */
export type AiEngineCitation = {
  key: string;
  name: string;
  cited: boolean;
  statusLabel: string;
};

export type AiHighlight = { title: string; detail: string };
export type AiKeywordTheme = { label: string; keywords: string[] };
export type AiRecommendation = {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low" | "other";
};

/** Optional: a tracked competitor's AI presence (filled by sources that have it). */
export type AiCompetitor = {
  name: string;
  domain: string | null;
  score: number | null; // 0–100 when known
  cited: boolean | null;
};

/** Optional: one tracked prompt's result on an engine. */
export type AiPromptResult = {
  prompt: string;
  engine: string | null; // which AI engine, when known
  mentioned: boolean;
  snippet: string | null;
};

export type AiSource = {
  label: string; // e.g. "Clicks", "SiteKeep"
  variant: string; // the feature-flag variant that produced it
  demo: boolean; // true when rendered from demo/sample data (no keys)
};

/** The normalized, source-agnostic AI-visibility payload the card renders. */
export type AiVisibility = {
  scoreLabel: AiScoreLabel;
  scorePct: number | null; // 0–100 gauge value
  explanation: string;
  isNewSite: boolean;
  engines: AiEngineCitation[];
  citedCount: number;
  whatsWorking: AiHighlight[];
  holdingBack: AiHighlight[];
  keywordThemes: AiKeywordTheme[];
  recommendations: AiRecommendation[];
  competitors: AiCompetitor[]; // [] when the source has none
  prompts: AiPromptResult[]; // [] when the source has none
  lastRefreshedAt: string | null;
  stale: boolean;
  processing: boolean;
  source: AiSource;
};

/**
 * Discriminated result. `disabled` = the flag is off (card not shown);
 * `not_mapped` = enabled but this client has no source configured; `expired`/
 * `missing` = credential problem (graceful reconnect state); `error` = anything else.
 */
export type AiVisibilityResult =
  | { ok: true; data: AiVisibility }
  | {
      ok: false;
      reason: "disabled" | "not_mapped" | "expired" | "missing" | "error";
      message: string;
      source?: AiSource;
    };
