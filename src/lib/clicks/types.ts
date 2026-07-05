// ─────────────────────────────────────────────────────────────────────────────
// Clicks.so AI-visibility POC — THROWAWAY plumbing (one pilot client, my cookie).
// Everything Clicks lives under src/lib/clicks + src/components/clicks so the whole
// thing is easy to delete or promote later. No cron, no multi-tenant auth.
// ─────────────────────────────────────────────────────────────────────────────

/** Raw shape of GET /projects/{id}/ai-visibility-report (only the fields we read). */
export type ClicksRawReport = {
  status: string; // "ready" | "processing" | …
  visibility_score: "poor" | "good" | "great" | string;
  score_explanation: string;
  is_new_site: boolean;
  llm_breakdown: Record<string, string>; // { chatgpt: "not_cited_yet", … }
  whats_working: Array<{ title: string; detail: string }>;
  holding_back: Array<{ title: string; detail: string }>;
  keyword_footprint: Array<{ label: string; keywords: string[]; color_theme?: string }>;
  recommendations: Array<{
    id: number;
    title: string;
    description: string;
    impact: string; // "high" | "medium" | "low"
    completed: boolean;
  }>;
  last_refreshed_at: string | null;
  stale: boolean;
};

// ---- Normalized shape SiteKeep renders (source-agnostic-ish, but POC-scoped) ----

export type ClicksModelCitation = {
  key: string; // chatgpt | perplexity | gemini | ai_overview | ai_mode
  name: string; // display name
  cited: boolean;
  statusLabel: string; // "Not cited yet" | "Cited" | …
};

export type ClicksKeywordTheme = { label: string; keywords: string[] };

export type ClicksRecommendation = {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low" | "other";
};

export type ClicksAiVisibility = {
  scoreLabel: "poor" | "good" | "great" | "unknown";
  scorePct: number | null; // gauge value (Clicks maps poor/good/great → 33/66/100)
  explanation: string;
  isNewSite: boolean;
  models: ClicksModelCitation[];
  citedCount: number;
  whatsWorking: Array<{ title: string; detail: string }>;
  holdingBack: Array<{ title: string; detail: string }>;
  keywordThemes: ClicksKeywordTheme[];
  recommendations: ClicksRecommendation[];
  lastRefreshedAt: string | null;
  stale: boolean;
  processing: boolean; // status !== "ready"
};

/** Discriminated result — never throws to the caller; UI branches on `reason`. */
export type ClicksResult =
  | { ok: true; data: ClicksAiVisibility }
  | { ok: false; reason: "expired" | "missing" | "not_mapped" | "error"; message: string };
