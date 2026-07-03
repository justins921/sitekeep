// Shared chart primitives: color bands, gauge geometry, static-SVG builders for
// the email report, and risk-meter metadata. Pure + client-safe (no imports),
// so the same math drives the React components and the emailed static SVG.

// Score bands (0–100). We use the app's existing convention — poor = magenta —
// rather than a raw red, to stay on the brand palette.
export const BAND = {
  good: "#6cad45", // 90–100
  mid: "#e87c2e", // 50–89
  bad: "#cb52cc", // 0–49
  none: "#b8b8b8",
} as const;

export type Band = keyof typeof BAND;

export function scoreBand(score: number | null | undefined): Band {
  if (score == null) return "none";
  if (score >= 90) return "good";
  if (score >= 50) return "mid";
  return "bad";
}

// ------------------------------------------------------------------ gauge

export type GaugeGeom = {
  size: number;
  stroke: number;
  r: number;
  cx: number;
  c: number; // circumference
  dash: number; // filled arc length
  color: string;
};

export function gaugeGeometry(score: number | null | undefined, size = 104, stroke = 9): GaugeGeom {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return { size, stroke, r, cx: size / 2, c, dash: frac * c, color: BAND[scoreBand(score)] };
}

/** Static donut gauge as an SVG string (email report — no scripts). */
export function gaugeSvg(
  score: number | null | undefined,
  opts: { size?: number; label?: string } = {},
): string {
  const g = gaugeGeometry(score, opts.size ?? 96, 9);
  const track = "#eeeeee";
  const value = score == null ? "—" : String(Math.round(score));
  return (
    `<svg width="${g.size}" height="${g.size}" viewBox="0 0 ${g.size} ${g.size}" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="${g.cx}" cy="${g.cx}" r="${g.r}" fill="none" stroke="${track}" stroke-width="${g.stroke}"/>` +
    `<circle cx="${g.cx}" cy="${g.cx}" r="${g.r}" fill="none" stroke="${g.color}" stroke-width="${g.stroke}" ` +
    `stroke-linecap="round" stroke-dasharray="${g.dash.toFixed(2)} ${(g.c - g.dash).toFixed(2)}" ` +
    `transform="rotate(-90 ${g.cx} ${g.cx})"/>` +
    `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${Math.round(g.size * 0.28)}" font-weight="700" fill="#0e213d">${value}</text>` +
    `</svg>`
  );
}

// --------------------------------------------------------------- line chart

export type LinePoint = { x: number; y: number };

/** Map a value series into an SVG polyline path within a w×h box. */
export function linePath(values: number[], w: number, h: number, min: number, max: number, pad = 4): string {
  if (values.length < 2) return "";
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Static comparison line chart (current solid + preceding dashed) as an SVG
 * string for the email report. Shares the y-scale so the two lines compare.
 */
export function comparisonLineSvg(
  current: number[],
  preceding: number[],
  opts: { color?: string; width?: number; height?: number } = {},
): string | null {
  if (current.length < 2) return null;
  const w = opts.width ?? 520;
  const h = opts.height ?? 140;
  const color = opts.color ?? "#0068ff";
  const all = [...current, ...preceding];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const cur = linePath(current, w, h, min, max);
  const prev = preceding.length >= 2 ? linePath(preceding, w, h, min, max) : "";
  return (
    `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">` +
    (prev ? `<path d="${prev}" fill="none" stroke="#b8b8b8" stroke-width="2" stroke-dasharray="5 4"/>` : "") +
    `<path d="${cur}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------- risk meter

export const RISK_LEVELS = ["minimal", "low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_META: Record<RiskLevel, { label: string; color: string }> = {
  minimal: { label: "Minimal", color: "#6cad45" },
  low: { label: "Low", color: "#8bbf3f" },
  medium: { label: "Medium", color: "#e87c2e" },
  high: { label: "High", color: "#e0592e" },
  critical: { label: "Critical", color: "#cb52cc" },
};

export function riskIndex(level: RiskLevel): number {
  return Math.max(0, RISK_LEVELS.indexOf(level));
}
