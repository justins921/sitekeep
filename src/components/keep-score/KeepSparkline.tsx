import { tokens } from "@/lib/design-tokens";

/**
 * 12-week Keep Score trend as a quiet inline sparkline. Nulls (unscored weeks)
 * are skipped; the line connects the scored points on a fixed 0–100 y-scale.
 */
export function KeepSparkline({
  points,
  color = tokens.keep,
  width = 132,
  height = 34,
}: {
  points: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const pad = 3;
  const n = points.length;
  const xFor = (i: number) => (n <= 1 ? pad : pad + (i * (width - 2 * pad)) / (n - 1));
  const yFor = (v: number) => height - pad - (v / 100) * (height - 2 * pad);

  const pts = points
    .map((v, i) => (v == null ? null : `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`))
    .filter(Boolean) as string[];
  if (pts.length === 0) return <div style={{ width, height }} />;

  const last = points.map((v, i) => ({ v, i })).filter((p) => p.v != null).at(-1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last?.v != null && (
        <circle cx={xFor(last.i)} cy={yFor(last.v)} r={2.5} fill={color} />
      )}
    </svg>
  );
}
