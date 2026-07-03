import { Card } from "@/components/ui";
import { TREND_META, type TrendKey, type TrendSeries } from "@/lib/trends";
import { Sparkline } from "./Sparkline";

/**
 * Compact trend charts for page-speed score, uptime %, and traffic sessions,
 * drawn from snapshot history. Shared by the authed detail page and the public
 * dashboard. Shows a clean low-data state until there are ≥2 points.
 */
export function TrendCharts({
  trends,
  show,
  accentColor,
}: {
  trends: TrendSeries;
  show: TrendKey[];
  accentColor?: string;
}) {
  if (show.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {show.map((key) => {
        const meta = TREND_META[key];
        const values = trends[key] ?? [];
        const latest = values.length ? values[values.length - 1] : null;
        const enough = values.length >= 2;
        return (
          <Card key={key} className="p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-muted">{meta.label}</p>
              {latest !== null && (
                <p className="text-sm font-bold text-ink">
                  {latest.toFixed(meta.digits)}
                  {meta.unit}
                </p>
              )}
            </div>
            <div className="mt-3">
              {enough ? (
                <Sparkline values={values} color={accentColor ?? meta.color} />
              ) : (
                <p className="py-3 text-xs text-faint">Not enough history yet</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
