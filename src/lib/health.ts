// Composite client health score — shared, client-safe helpers.
//
// Phase 14 uses only the red/yellow/green banding (the admin grid + badges).
// Phase 15 adds the scoring model (computeHealthScore) that turns a client's
// latest snapshots into a 0–100 number stored back in metric_snapshots.
//
// Keep this module free of server-only imports so Client Components (badges,
// the admin grid) can import the banding/labels directly.

export type HealthBand = "green" | "yellow" | "red" | "none";

/** Red < 50, Yellow 50–79, Green 80+. Null/undefined → "none" (unscored). */
export function healthBand(score: number | null | undefined): HealthBand {
  if (score === null || score === undefined || !Number.isFinite(score)) return "none";
  if (score < 50) return "red";
  if (score < 80) return "yellow";
  return "green";
}

export const HEALTH_BAND_META: Record<
  HealthBand,
  { label: string; tone: "green" | "orange" | "magenta" | "neutral"; dot: string; text: string }
> = {
  green: { label: "Healthy", tone: "green", dot: "#6cad45", text: "text-accent-green" },
  yellow: { label: "Needs attention", tone: "orange", dot: "#e87c2e", text: "text-accent-orange" },
  red: { label: "At risk", tone: "magenta", dot: "#cb52cc", text: "text-accent-magenta" },
  none: { label: "Not scored", tone: "neutral", dot: "#b8b8b8", text: "text-muted" },
};
