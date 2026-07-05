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

/** Raw shape of GET /projects/{id}/all-favorite-competitiors (sibling endpoint). */
export type ClicksRawCompetitors = {
  competitors?: Array<{
    name?: string;
    domain?: string | null;
    visibility_score?: string | number | null;
    cited?: boolean | null;
  }>;
};

/** Raw shape of GET /projects/{id}/ai-prompt-results (sibling endpoint). */
export type ClicksRawPromptResults = {
  prompts?: Array<{
    prompt?: string;
    text?: string;
    engine?: string | null;
    model?: string | null;
    mentioned?: boolean | null;
    cited?: boolean | null;
    snippet?: string | null;
  }>;
};
