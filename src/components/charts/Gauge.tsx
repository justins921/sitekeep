import { gaugeGeometry } from "@/lib/charts";

/**
 * Donut score gauge, 0–100, color-banded (0–49 / 50–89 / 90–100). Pure SVG —
 * renders identically in server pages and (via gaugeSvg) the email report.
 */
export function Gauge({
  score,
  label,
  size = 104,
}: {
  score: number | null;
  label?: string;
  size?: number;
}) {
  const g = gaugeGeometry(score, size, 9);
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: g.size, height: g.size }}>
        <svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`}>
          <circle cx={g.cx} cy={g.cx} r={g.r} fill="none" stroke="#eeeeee" strokeWidth={g.stroke} />
          <circle
            cx={g.cx}
            cy={g.cx}
            r={g.r}
            fill="none"
            stroke={g.color}
            strokeWidth={g.stroke}
            strokeLinecap="round"
            strokeDasharray={`${g.dash} ${g.c - g.dash}`}
            transform={`rotate(-90 ${g.cx} ${g.cx})`}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-ink"
          style={{ fontSize: Math.round(g.size * 0.26) }}
        >
          {score == null ? "—" : Math.round(score)}
        </span>
      </div>
      {label && <span className="mt-1.5 text-xs font-medium text-muted">{label}</span>}
    </div>
  );
}

/** The 0–49 / 50–89 / 90–100 color legend shown under the gauges. */
export function GaugeLegend() {
  const items: Array<[string, string]> = [
    ["0–49", "#cb52cc"],
    ["50–89", "#e87c2e"],
    ["90–100", "#6cad45"],
  ];
  return (
    <div className="flex items-center gap-4">
      {items.map(([range, color]) => (
        <span key={range} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {range}
        </span>
      ))}
    </div>
  );
}
