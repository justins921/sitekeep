import { weekStatusColor } from "@/lib/design-tokens";
import type { SiteWeek } from "@/lib/keep-score/overview";

/**
 * The signature element: one square per week per site (GitHub-contribution
 * style). green = healthy, amber = degraded/resolved-incident, red = incident or
 * score < 70, empty = no data. Keep everything else quiet — this is the one bold
 * visual.
 */
export function GreenWeekGrid({
  weeks,
  size = 14,
  gap = 3,
}: {
  weeks: SiteWeek[];
  size?: number;
  gap?: number;
}) {
  return (
    <div className="flex flex-wrap" style={{ gap }} role="img" aria-label="Weekly health history">
      {weeks.map((w, i) => {
        const label =
          w.status === "none"
            ? `Week of ${w.weekStart}: no data`
            : `Week of ${w.weekStart}: ${w.status}${w.score != null ? ` (${w.score})` : ""}`;
        return (
          <span
            key={i}
            title={label}
            style={{
              width: size,
              height: size,
              borderRadius: 3,
              backgroundColor: weekStatusColor[w.status],
            }}
          />
        );
      })}
    </div>
  );
}
