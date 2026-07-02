import { cn } from "@/lib/utils";
import { Card } from "./Card";

type Trend = "up" | "down" | "flat";

const trendMeta: Record<Trend, { color: string; arrow: string }> = {
  up: { color: "text-accent-green", arrow: "↑" },
  down: { color: "text-accent-orange", arrow: "↓" },
  flat: { color: "text-muted", arrow: "→" },
};

/**
 * Metric tile — big value, label, optional trend and unit. Used on both the
 * authed client detail page and the public white-label dashboard so numbers
 * render identically everywhere.
 */
export function StatCard({
  label,
  value,
  unit,
  trend,
  trendLabel,
  accent = "text-ink",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  trend?: Trend;
  trendLabel?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("text-3xl font-bold tracking-tight", accent)}>
          {value}
        </span>
        {unit ? <span className="text-sm font-medium text-muted">{unit}</span> : null}
      </div>
      {trend ? (
        <p className={cn("mt-2 text-xs font-medium", trendMeta[trend].color)}>
          {trendMeta[trend].arrow} {trendLabel}
        </p>
      ) : null}
    </Card>
  );
}
