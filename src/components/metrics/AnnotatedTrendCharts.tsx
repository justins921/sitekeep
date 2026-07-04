import { Card } from "@/components/ui";
import { TREND_META, type TrendKey, type DatedTrendSeries } from "@/lib/trends";
import { AnnotatedLineChart } from "@/components/charts/AnnotatedLineChart";
import type { AnnoMarker } from "@/components/charts/AnnotatedLineChartImpl";
import { categoryMeta } from "@/lib/annotations";

export type ChartAnnotation = {
  annotation_date: string;
  label: string;
  description: string | null;
  category: string | null;
};

/** Annotation date (YYYY-MM-DD) → ms at local noon (avoids tz off-by-one). */
function toMarker(a: ChartAnnotation): AnnoMarker {
  const meta = categoryMeta(a.category);
  return {
    t: new Date(`${a.annotation_date}T12:00:00`).getTime(),
    label: a.label,
    description: a.description,
    icon: meta.icon,
    color: meta.color,
  };
}

/**
 * Trend charts (page speed / uptime / traffic) on a real time axis, with
 * annotation markers overlaid. Shared by the client detail page and the public
 * dashboard; markers are read-only here (editing lives in AnnotationManager).
 */
export function AnnotatedTrendCharts({
  series,
  annotations,
  show,
  accentColor,
}: {
  series: DatedTrendSeries;
  annotations: ChartAnnotation[];
  show: TrendKey[];
  accentColor?: string;
}) {
  if (show.length === 0) return null;
  const markers = annotations.map(toMarker);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {show.map((key) => {
        const meta = TREND_META[key];
        const points = series[key] ?? [];
        const latest = points.length ? points[points.length - 1].v : null;
        const enough = points.length >= 2;
        // Only markers within the chart's time window are meaningful.
        const domainMarkers = enough
          ? markers.filter((m) => m.t >= points[0].t && m.t <= points[points.length - 1].t)
          : [];
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
                <AnnotatedLineChart
                  points={points}
                  annotations={domainMarkers}
                  color={accentColor ?? meta.color}
                  height={150}
                  unit={meta.unit}
                  digits={meta.digits}
                />
              ) : (
                <p className="py-6 text-center text-xs text-faint">Not enough history yet</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
