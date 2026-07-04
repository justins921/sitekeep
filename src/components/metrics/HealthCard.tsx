import { Card } from "@/components/ui";
import { healthBand, HEALTH_BAND_META } from "@/lib/health";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import type { HealthSnapshot, HealthServiceBreakdown } from "@/lib/health-scores";
import { RISK_META } from "@/lib/charts";

// "Health Score" card for the client detail page: the composite 0–100 number
// plus which services contributed what. Mirrors the SQL scoring model so the
// breakdown always explains the headline number.

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

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-ink">Health score</h3>
          <p className="mt-1 text-sm text-muted">
            A single number rolling up every enabled service.
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold leading-none" style={{ color: meta.dot }}>
            {score === null ? "—" : Math.round(score)}
          </div>
          <div className={`mt-1 text-xs font-semibold ${meta.text}`}>{meta.label}</div>
        </div>
      </div>

      {score === null ? (
        <p className="mt-5 rounded-[var(--radius-card)] border border-line bg-canvas-alt/60 p-4 text-sm text-muted">
          Refresh the metrics above to generate a health score.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {ORDER.filter((k) => health?.services?.[k]).map((k) => {
            const b = health!.services[k] as HealthServiceBreakdown;
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
                      backgroundColor: b.scored ? meta.dot : "transparent",
                    }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-sm text-muted">
                  {valueLabel(k, b)}
                </span>
              </div>
            );
          })}
          <p className="pt-1 text-xs text-faint">
            Each enabled service contributes equally; services without data are
            skipped rather than penalized.
          </p>
        </div>
      )}
    </Card>
  );
}
