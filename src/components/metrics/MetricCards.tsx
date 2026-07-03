import { Badge, Card } from "@/components/ui";

// Incident list — shared by the authed detail page and the public dashboard.
// (The per-service metric cards now live in ServiceCards.tsx.)

export type IncidentEntry = {
  type: "downtime" | "ssl_expiring";
  started_at: string;
  resolved_at: string | null;
  details?: { days_to_expiry?: number; status_code?: number | null } | null;
};

const INCIDENT_LABEL = { downtime: "Downtime", ssl_expiring: "SSL expiring" } as const;

function incidentDuration(started: string, resolved: string | null): string {
  const end = resolved ? new Date(resolved).getTime() : Date.now();
  const mins = Math.max(1, Math.round((end - new Date(started).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function IncidentList({ incidents }: { incidents: IncidentEntry[] }) {
  if (incidents.length === 0) {
    return <Card className="p-5 text-sm text-muted">No incidents recorded. All clear.</Card>;
  }
  return (
    <Card className="divide-y divide-line p-0">
      {incidents.map((i, idx) => {
        const open = !i.resolved_at;
        return (
          <div key={idx} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-3">
              <Badge tone={open ? "magenta" : "neutral"}>{open ? "Ongoing" : "Resolved"}</Badge>
              <div>
                <p className="text-sm font-medium text-ink">{INCIDENT_LABEL[i.type]}</p>
                <p className="text-xs text-muted">
                  {new Date(i.started_at).toLocaleString()}
                  {i.type === "ssl_expiring" && typeof i.details?.days_to_expiry === "number"
                    ? ` · ${i.details.days_to_expiry}d to expiry`
                    : ""}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted">{incidentDuration(i.started_at, i.resolved_at)}</span>
          </div>
        );
      })}
    </Card>
  );
}
