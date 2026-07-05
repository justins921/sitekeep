import { Card } from "@/components/ui";
import { healthBand, serviceHealthBand, HEALTH_BAND_META } from "@/lib/health";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import type { HealthSnapshot, HealthServiceBreakdown } from "@/lib/health-scores";
import { RISK_META } from "@/lib/charts";

// Composite health hero: the 0–100 number colored by threshold, plus a
// per-service breakdown where each bar is colored by ITS own value (Uptime 100%
// green, "High" security red, Page Speed 64 amber). Leads the dashboard on both
// the agency detail view and the public page.

const ORDER: ServiceType[] = ["page_speed", "uptime", "security", "traffic"];

function valueLabel(key: string, b: HealthServiceBreakdown): string {
  if (!b.scored) return "No data";
  if (key === "security") {
    const risk = String(b.value);
    return RISK_META[risk as keyof typeof RISK_META]?.label ?? risk;
  }
  if (key === "uptime") return `${b.value}%`;
  if (key === "traffic") {
    const n = Number(b.value);
    return `${n > 0 ? "+" : ""}${n}% users`;
  }
  return `${b.value}`; // page_speed performance
}

export function HealthCard({ health }: { health: HealthSnapshot | null }) {
  const score = health?.score ?? null;
  const band = healthBand(score);
  const meta = HEALTH_BAND_META[band];

  const services = ORDER.filter((k) => health?.services?.[k]);

  return (
    <Card className="p-6 sm:p-7">
      <div className="grid gap-6 sm:grid-cols-[minmax(180px,auto)_1fr] sm:items-center sm:gap-8">
        {/* Score block */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${meta.dot}1a` }}
          >
            <span className="text-5xl font-bold leading-none" style={{ color: meta.dot }}>
              {score === null ? "—" : Math.round(score)}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Health score</p>
            <p className={`mt-0.5 text-sm font-semibold ${meta.text}`}>{meta.label}</p>
            <p className="mt-1 text-xs text-muted">Rolls up every enabled service.</p>
          </div>
        </div>

        {/* Breakdown */}
        {score === null ? (
          <p className="rounded-[var(--radius-card)] border border-line bg-canvas-alt/60 p-4 text-sm text-muted">
            Refresh the metrics below to generate a health score.
          </p>
        ) : (
          <div className="space-y-2.5">
            {services.map((k) => {
              const b = health!.services[k] as HealthServiceBreakdown;
              const sband = serviceHealthBand(k, b);
              const smeta = HEALTH_BAND_META[sband];
              const pct = b.scored ? Math.round((b.fraction ?? 0) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm font-medium text-ink">
                    {SERVICE_META[k].label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-alt">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: b.scored ? smeta.dot : "transparent",
                      }}
                    />
                  </div>
                  <span className={`w-24 shrink-0 text-right text-sm font-medium ${smeta.text}`}>
                    {valueLabel(k, b)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
