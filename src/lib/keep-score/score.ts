// Keep Score — one 0–100 score per site. Pure + import-light so it unit-tests
// with node --test. Weights live here (single source of truth, v1 configurable).

export type KeepDimension = "uptime" | "form" | "performance" | "ssl_domain" | "links";

/** v1 weights. Tweak here only. Must sum to 1. */
export const KEEP_WEIGHTS: Record<KeepDimension, number> = {
  uptime: 0.4,
  form: 0.2,
  performance: 0.2,
  ssl_domain: 0.1,
  links: 0.1,
};

export const KEEP_DIMENSION_LABELS: Record<KeepDimension, string> = {
  uptime: "Uptime",
  form: "Form delivery",
  performance: "Performance",
  ssl_domain: "SSL & domain",
  links: "Broken links",
};

/** Sub-scores 0–100 per dimension; null = not measured (or no form configured). */
export type KeepInputs = Partial<Record<KeepDimension, number | null>>;

export type KeepContribution = {
  dimension: KeepDimension;
  subscore: number; // 0–100
  weight: number; // effective weight after redistribution
  points: number; // subscore * weight
};

export type KeepScoreResult = {
  score: number | null; // 0–100, null when nothing could be scored
  contributions: KeepContribution[];
  measured: KeepDimension[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Weighted Keep Score. Redistribution rules (per spec):
 *  - No form configured (form == null) → its weight moves to uptime.
 *  - Any other missing dimension → its weight is spread proportionally across
 *    the remaining measured dimensions (keeps the score a true 0–100).
 */
export function computeKeepScore(inputs: KeepInputs): KeepScoreResult {
  const present = (Object.keys(KEEP_WEIGHTS) as KeepDimension[]).filter(
    (d) => typeof inputs[d] === "number",
  );
  if (present.length === 0) return { score: null, contributions: [], measured: [] };

  const weights: Record<string, number> = {};
  for (const d of present) weights[d] = KEEP_WEIGHTS[d];

  // No form → fold form's weight into uptime (if uptime is present).
  if (typeof inputs.form !== "number" && present.includes("uptime")) {
    weights.uptime += KEEP_WEIGHTS.form;
  }

  // Renormalize so effective weights sum to 1 across measured dimensions.
  const total = present.reduce((s, d) => s + weights[d], 0);
  const contributions: KeepContribution[] = present.map((d) => {
    const subscore = clamp(inputs[d] as number);
    const weight = weights[d] / total;
    return { dimension: d, subscore, weight, points: subscore * weight };
  });

  const score = Math.round(contributions.reduce((s, c) => s + c.points, 0));
  return { score, contributions, measured: present };
}

export type WeekStatus = "green" | "amber" | "red" | "none";

/**
 * Week status feeding the green-week grid + streak:
 *  - red: score < 70, OR an unresolved incident in the week
 *  - amber: score 70–89, OR a resolved incident occurred in the week
 *  - green: score ≥ 90 and no incidents
 *  - none: no score for the week (empty square)
 */
export function weekStatus(
  score: number | null,
  opts: { unresolvedIncident?: boolean; resolvedIncident?: boolean } = {},
): WeekStatus {
  if (opts.unresolvedIncident) return "red";
  if (score == null) return "none";
  if (score < 70) return "red";
  if (score < 90 || opts.resolvedIncident) return "amber";
  return "green";
}
