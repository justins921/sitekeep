// Pure sparkline geometry, shared by the React <Sparkline> (dashboard + public)
// and the email renderer's static inline SVG so all three draw identically.
// No dependencies, no server-only imports.

export type SparkGeom = {
  line: string; // path `d` for the trend line
  area: string; // path `d` for the filled area under it
  last: { x: number; y: number }; // last point (for the end dot)
};

/**
 * Map values to SVG path strings within a w×h box. Returns null when there
 * aren't at least 2 points — callers render a "not enough history" state.
 */
export function sparklineGeometry(
  values: number[],
  w: number,
  h: number,
  pad = 3,
): SparkGeom | null {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + (h - pad * 2) * (1 - (v - min) / span),
  }));

  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area =
    `${line} L${pts[pts.length - 1].x.toFixed(1)},${(h - pad).toFixed(1)} ` +
    `L${pts[0].x.toFixed(1)},${(h - pad).toFixed(1)} Z`;

  return { line, area, last: pts[pts.length - 1] };
}

/** Static inline-SVG string for the email report (no scripts). */
export function sparklineSvg(
  values: number[],
  opts: { color: string; width?: number; height?: number },
): string | null {
  const w = opts.width ?? 150;
  const h = opts.height ?? 40;
  const g = sparklineGeometry(values, w, h);
  if (!g) return null;
  return (
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="${g.area}" fill="${opts.color}" fill-opacity="0.12"/>` +
    `<path d="${g.line}" fill="none" stroke="${opts.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}
