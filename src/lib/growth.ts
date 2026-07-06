// Pure logic deciding WHICH upsell nudges to show for a client, based on real
// opportunity signals on their dashboard. Keeping it import-light means it
// unit-tests and the thresholds live in one place. A tool only nudges when a
// concrete gap fires — so the CTA reads as a smart suggestion, not a standing ad.

export type UpsellSignals = {
  aiEnabled: boolean; // AI Visibility flag on + data present
  aiCited: number | null; // engines the brand is cited in
  aiEngines: number | null; // engines measured
  aiScoreLabel: string | null; // 'poor' | 'good' | 'great' | 'unknown'
  gbpConnected: boolean;
  gbpCompleteness: number | null; // 0–100
  gbpRating: number | null; // 0–5
  gbpReviews: number | null;
  gscConnected: boolean;
  gscPosition: number | null; // avg position (lower is better)
  healthScore: number | null; // 0–100
};

export type UpsellNudge = { key: string; reason: string };

// Thresholds (single source of truth).
export const AI_MIN_CITED_RATIO = 0.5;
export const GBP_MIN_COMPLETENESS = 80;
export const GBP_MIN_RATING = 4.0;
export const GBP_MIN_REVIEWS = 10;
export const GSC_MAX_POSITION = 20;
export const HEALTH_MIN = 70;

function gbpHasGap(s: UpsellSignals): boolean {
  if (!s.gbpConnected) return false;
  return (
    (s.gbpCompleteness != null && s.gbpCompleteness < GBP_MIN_COMPLETENESS) ||
    (s.gbpRating != null && s.gbpRating < GBP_MIN_RATING) ||
    (s.gbpReviews != null && s.gbpReviews < GBP_MIN_REVIEWS)
  );
}

function seoHasGap(s: UpsellSignals): boolean {
  return s.gscConnected && s.gscPosition != null && s.gscPosition > GSC_MAX_POSITION;
}

/** Reason to nudge Clicks (AI-visibility), or null if no signal fires. */
function clicksReason(s: UpsellSignals): string | null {
  if (s.aiEnabled && s.aiCited != null && s.aiEngines != null && s.aiEngines > 0) {
    if (s.aiCited / s.aiEngines < AI_MIN_CITED_RATIO) {
      return `Cited in only ${s.aiCited} of ${s.aiEngines} AI engines — track and grow AI-search visibility.`;
    }
    return null; // AI visibility is already healthy — no nudge
  }
  if (s.aiScoreLabel === "poor") {
    return "AI-search visibility is poor — track citations across ChatGPT, Perplexity & Google AI.";
  }
  // No AI signal yet, but weak SEO/GBP suggests they're likely invisible in AI too.
  if (seoHasGap(s) || gbpHasGap(s)) {
    return "See where this client shows up across AI search — ChatGPT, Perplexity & Google AI.";
  }
  return null;
}

/** Reason to nudge Semflow (SEO), or null if no signal fires. */
function semflowReason(s: UpsellSignals): string | null {
  if (seoHasGap(s)) {
    return `Average search position is ${Math.round(s.gscPosition as number)} — an SEO push could lift rankings.`;
  }
  if (gbpHasGap(s)) {
    if (s.gbpCompleteness != null && s.gbpCompleteness < GBP_MIN_COMPLETENESS) {
      return `Google profile is ${s.gbpCompleteness}% complete — quick local-SEO wins available.`;
    }
    if (s.gbpReviews != null && s.gbpReviews < GBP_MIN_REVIEWS) {
      return `Only ${s.gbpReviews} Google reviews — a review-growth push could help.`;
    }
    if (s.gbpRating != null && s.gbpRating < GBP_MIN_RATING) {
      return `Google rating is ${s.gbpRating.toFixed(1)} — reputation management could lift it.`;
    }
  }
  if (s.healthScore != null && s.healthScore < HEALTH_MIN) {
    return `Overall site health is ${s.healthScore}/100 — room to optimize.`;
  }
  return null;
}

/**
 * Which tools to nudge for this client, with a contextual reason. Empty when no
 * opportunity fires (the CTA then renders nothing). URL/config filtering happens
 * at the call site against affiliateTools().
 */
export function computeUpsells(s: UpsellSignals): UpsellNudge[] {
  const nudges: UpsellNudge[] = [];
  const clicks = clicksReason(s);
  if (clicks) nudges.push({ key: "clicks", reason: clicks });
  const semflow = semflowReason(s);
  if (semflow) nudges.push({ key: "semflow", reason: semflow });
  return nudges;
}
