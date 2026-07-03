import { sparklineGeometry } from "@/lib/sparkline";

/**
 * Compact inline SVG sparkline. Pure/presentational (no client JS), so it works
 * in both server pages and the client bundle. Renders nothing for <2 points —
 * callers show a "not enough history" state instead.
 */
export function Sparkline({
  values,
  color,
  width = 150,
  height = 40,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const g = sparklineGeometry(values, width, height);
  if (!g) return null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-full"
      role="img"
      aria-hidden="true"
    >
      <path d={g.area} fill={color} fillOpacity={0.12} />
      <path
        d={g.line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={g.last.x} cy={g.last.y} r={2.5} fill={color} />
    </svg>
  );
}
