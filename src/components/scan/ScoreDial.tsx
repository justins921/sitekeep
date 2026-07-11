import { scoreColor } from "@/lib/design-tokens";

/**
 * The one bold number of the scan: a big Keep Score in tabular numerals inside a
 * quiet progress ring, colored by the health band (green ≥90, amber ≥70, red).
 */
export function ScoreDial({
  score,
  size = 168,
}: {
  score: number | null;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-5xl font-bold leading-none" style={{ color }}>
          {score ?? "—"}
        </span>
        <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
          Keep Score
        </span>
      </div>
    </div>
  );
}
