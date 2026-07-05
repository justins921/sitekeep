// ─────────────────────────────────────────────────────────────────────────────
// Clicks.so provider — raw API shapes only. The normalized/rendered shape is the
// shared AiVisibility in src/lib/ai-visibility/types.ts (Clicks maps into it via
// normalize.ts), so the card stays source-agnostic.
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

// GET /projects/{id}/all-favorite-competitiors → { favorites: [...] }. Item shape
// is parsed permissively (empty for the pilot, so exact fields are best-effort).
export type ClicksRawCompetitors = {
  favorites?: Array<Record<string, unknown>>;
};

// GET /projects/{id}/ai-prompt-results → { success, date_from, date_to, prompts, engines }.
export type ClicksRawPromptResults = {
  prompts?: Array<Record<string, unknown>>;
  engines?: Array<Record<string, unknown>>;
};

/** How an agency authenticates to Clicks. */
export type ClicksAuthMode = "session" | "token";
export type ClicksConnection = { authMode: ClicksAuthMode; credential: string };
