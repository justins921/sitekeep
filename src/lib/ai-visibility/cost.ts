// Pure cost model + control constants for the standalone AI-visibility pipeline.
// Kept import-light so it unit-tests and can be shown in the UI as an estimate
// before an agency opts into a heavier cadence / extra models.

/** Hard cap on tracked prompts per client (cost control). Default target is 5. */
export const PROMPT_CAP = 10;
export const DEFAULT_PROMPT_COUNT = 5;

/** Cadences an agency can opt into. Monthly is the default (cheapest). */
export type Cadence = "monthly" | "weekly";
export const RUNS_PER_MONTH: Record<Cadence, number> = { monthly: 1, weekly: 4 };

// Rough Perplexity Sonar pricing: a per-request fee plus token cost. One tracked
// prompt ≈ one grounded request with a short answer. Deliberately conservative so
// the estimate shown to the agency is an upper bound, not a surprise.
export const SONAR_COST_PER_REQUEST = 0.005; // $ per grounded request (incl. ~800 output tokens)
export const EXTRA_MODEL_MULTIPLIER = 2; // enabling optional base models ~doubles calls

export type CostOptions = {
  promptCount: number;
  cadence?: Cadence;
  extraModels?: boolean; // base (non-grounded) models in addition to Sonar
};

/** Estimated USD cost for a SINGLE run (one pass over the tracked prompts). */
export function estimateRunCost(promptCount: number, extraModels = false): number {
  const prompts = Math.min(Math.max(promptCount, 0), PROMPT_CAP);
  const perModel = prompts * SONAR_COST_PER_REQUEST;
  const cost = extraModels ? perModel * EXTRA_MODEL_MULTIPLIER : perModel;
  return Math.round(cost * 10000) / 10000;
}

/** Estimated USD cost per MONTH given the cadence — the number to show on opt-in. */
export function estimateMonthlyCost(opts: CostOptions): number {
  const runs = RUNS_PER_MONTH[opts.cadence ?? "monthly"];
  const cost = estimateRunCost(opts.promptCount, opts.extraModels) * runs;
  return Math.round(cost * 10000) / 10000;
}
