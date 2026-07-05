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
  { label: string; tone: "green" | "orange" | "red" | "neutral"; dot: string; text: string }
> = {
  green: { label: "Healthy", tone: "green", dot: "#6cad45", text: "text-accent-green" },
  yellow: { label: "Needs attention", tone: "orange", dot: "#e87c2e", text: "text-accent-orange" },
  red: { label: "At risk", tone: "red", dot: "#e5484d", text: "text-accent-red" },
  none: { label: "Not scored", tone: "neutral", dot: "#767676", text: "text-muted" },
};

/**
 * Band one service's own value for the health-breakdown bar, so each bar is
 * colored by ITS metric (Uptime 100% = green, "High" security = red, Page Speed
 * 64 = amber) rather than by the overall composite band.
 */
export function serviceHealthBand(
  key: string,
  b: { scored?: boolean; value?: number | string } | undefined | null,
): HealthBand {
  if (!b?.scored || b.value === undefined || b.value === null) return "none";
  switch (key) {
    case "page_speed": {
      const v = Number(b.value);
      return v >= 90 ? "green" : v >= 50 ? "yellow" : "red";
    }
    case "uptime": {
      const v = Number(b.value);
      return v >= 99.5 ? "green" : v >= 95 ? "yellow" : "red";
    }
    case "security": {
      const r = String(b.value);
      return r === "minimal" || r === "low" ? "green" : r === "medium" ? "yellow" : "red";
    }
    case "traffic": {
      const c = Number(b.value); // 30-day user-trend %
      return c >= 0 ? "green" : c >= -25 ? "yellow" : "red";
    }
    default:
      return "none";
  }
}
