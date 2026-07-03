import { RISK_LEVELS, RISK_META, riskIndex, type RiskLevel } from "@/lib/charts";

/**
 * Horizontal Minimal→Critical risk bar with a marker at the computed level.
 * Pure/presentational.
 */
export function RiskMeter({ level }: { level: RiskLevel }) {
  const idx = riskIndex(level);
  // Marker sits at the center of the active segment.
  const markerPct = ((idx + 0.5) / RISK_LEVELS.length) * 100;
  const meta = RISK_META[level];

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-muted">Risk level</span>
        <span className="text-sm font-bold" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div className="relative mt-3">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {RISK_LEVELS.map((l) => (
            <div
              key={l}
              className="flex-1"
              style={{ backgroundColor: RISK_META[l].color, opacity: l === level ? 1 : 0.28 }}
            />
          ))}
        </div>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-soft"
          style={{ left: `${markerPct}%`, backgroundColor: meta.color }}
        />
      </div>
      <div className="mt-2 flex justify-between">
        {RISK_LEVELS.map((l) => (
          <span
            key={l}
            className="text-[10px]"
            style={{ color: l === level ? meta.color : "#b8b8b8", fontWeight: l === level ? 600 : 400 }}
          >
            {RISK_META[l].label}
          </span>
        ))}
      </div>
    </div>
  );
}
