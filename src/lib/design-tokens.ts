/**
 * SiteKeep design tokens — the single JS source of truth for colors used outside
 * CSS (Recharts, the green-week grid, email rendering, canvas). Keep in lockstep
 * with the CSS `@theme` in src/app/globals.css. Never inline hex elsewhere.
 *
 * Identity: "green means healthy." keep-green is the only signature color; amber
 * is degraded/warnings; red is active incidents ONLY (never decorative); a blue
 * accent carries interactive elements so green stays meaningful.
 */
export const tokens = {
  // Interactive accent (blue, non-green)
  brand: "#4c8dff",
  brandHover: "#6ba1ff",

  // keep-green signature (health / streak / success)
  keep: "#35c46a",
  keepDeep: "#1f8a4c",
  keepBright: "#5fd98c",

  // Status
  amber: "#f5a524",
  red: "#e5484d",

  // Ink / text (light on dark)
  ink: "#e6edf3",
  body: "#c4cdd6",
  muted: "#8b98a5",
  faint: "#6b7885",

  // Surfaces
  surface: "#141b22",
  canvas: "#0b0f14",
  canvasAlt: "#1c2630",
  line: "#2a3742",
} as const;

/** Keep Score / week-status color for a 0–100 score. */
export function scoreColor(score: number | null): string {
  if (score == null) return tokens.faint;
  if (score >= 90) return tokens.keep;
  if (score >= 70) return tokens.amber;
  return tokens.red;
}

export type WeekStatus = "green" | "amber" | "red" | "none";

/** Fill color for a green-week grid square by week status. */
export const weekStatusColor: Record<WeekStatus, string> = {
  green: tokens.keep,
  amber: tokens.amber,
  red: tokens.red,
  none: "#1f2a35", // empty/no-data square (slightly above surface)
};
