import { Badge, Card, StatCard } from "@/components/ui";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import type {
  PageSpeedData,
  SecurityData,
  TrafficData,
  UptimeData,
} from "@/lib/metrics/types";
import { cls, ms, rate, ratingAccent, scoreAccent, secs, timeAgo } from "./format";

// ---------------------------------------------------------------- Page Speed

export function PageSpeedMetrics({ data }: { data: PageSpeedData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Performance"
        value={data.performance_score ?? "—"}
        unit={data.performance_score !== null ? "/ 100" : undefined}
        accent={scoreAccent(data.performance_score)}
      />
      <StatCard
        label="LCP"
        value={secs(data.lcp_ms)}
        unit={data.lcp_ms !== null ? "s" : undefined}
        accent={ratingAccent[rate("lcp", data.lcp_ms)]}
      />
      <StatCard
        label="CLS"
        value={cls(data.cls)}
        accent={ratingAccent[rate("cls", data.cls)]}
      />
      <StatCard
        label="INP"
        value={ms(data.inp_ms)}
        unit={data.inp_ms !== null ? "ms" : undefined}
        accent={ratingAccent[rate("inp", data.inp_ms)]}
      />
      <StatCard
        label="FCP"
        value={secs(data.fcp_ms)}
        unit={data.fcp_ms !== null ? "s" : undefined}
        accent={ratingAccent[rate("fcp", data.fcp_ms)]}
      />
      <StatCard
        label="TBT"
        value={ms(data.tbt_ms)}
        unit={data.tbt_ms !== null ? "ms" : undefined}
        accent={ratingAccent[rate("tbt", data.tbt_ms)]}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Security

const HEADER_LABELS: Array<[keyof SecurityData["headers"], string]> = [
  ["hsts", "HSTS"],
  ["csp", "Content-Security-Policy"],
  ["x_frame_options", "X-Frame-Options"],
  ["x_content_type_options", "X-Content-Type-Options"],
  ["referrer_policy", "Referrer-Policy"],
];

const gradeTone = { pass: "green", warn: "orange", fail: "magenta" } as const;
const gradeLabel = { pass: "Secure", warn: "Needs attention", fail: "At risk" };

export function SecurityMetrics({ data }: { data: SecurityData }) {
  const presentCount = HEADER_LABELS.filter(([k]) => data.headers[k]).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col justify-center p-5">
          <p className="text-sm font-medium text-muted">Overall</p>
          <div className="mt-2">
            <Badge tone={gradeTone[data.grade]}>{gradeLabel[data.grade]}</Badge>
          </div>
        </Card>
        <StatCard
          label="HTTPS enforced"
          value={data.https_enforced ? "Yes" : "No"}
          accent={data.https_enforced ? "text-accent-green" : "text-accent-magenta"}
        />
        <StatCard
          label="SSL expires in"
          value={data.ssl_days_to_expiry ?? "—"}
          unit={data.ssl_days_to_expiry !== null ? "days" : undefined}
          accent={
            data.ssl_days_to_expiry === null
              ? "text-ink"
              : data.ssl_days_to_expiry < 14
                ? "text-accent-magenta"
                : data.ssl_days_to_expiry < 30
                  ? "text-accent-orange"
                  : "text-accent-green"
          }
        />
        <StatCard
          label="Security headers"
          value={`${presentCount}/${HEADER_LABELS.length}`}
          accent={presentCount >= 4 ? "text-accent-green" : "text-accent-orange"}
        />
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium text-muted">Header findings</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {HEADER_LABELS.map(([key, label]) => {
            const present = data.headers[key];
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span className={present ? "text-accent-green" : "text-accent-magenta"}>
                  {present ? "✓" : "✕"}
                </span>
                <span className="text-body">{label}</span>
              </li>
            );
          })}
        </ul>
        {data.cert_issuer && (
          <p className="mt-4 text-xs text-muted">
            Certificate issued by {data.cert_issuer}
            {data.ssl_valid_to
              ? ` · valid to ${new Date(data.ssl_valid_to).toLocaleDateString()}`
              : ""}
          </p>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- Traffic

export function TrafficMetrics({ data }: { data: TrafficData }) {
  const trend =
    data.trend_pct > 0 ? "up" : data.trend_pct < 0 ? "down" : "flat";
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Sessions"
        value={data.sessions.toLocaleString()}
        trend={trend}
        trendLabel={`${data.trend_pct > 0 ? "+" : ""}${data.trend_pct}% vs prior ${data.range_days}d`}
      />
      <StatCard label="Users" value={data.users.toLocaleString()} />
      <StatCard label="Pageviews" value={data.pageviews.toLocaleString()} />
    </div>
  );
}

// -------------------------------------------------------------------- Uptime

const UPTIME_STATUS: Record<UptimeData["status"], { label: string; tone: "green" | "magenta" | "neutral"; accent: string }> = {
  up: { label: "Operational", tone: "green", accent: "text-accent-green" },
  down: { label: "Down", tone: "magenta", accent: "text-accent-magenta" },
  unknown: { label: "No data yet", tone: "neutral", accent: "text-ink" },
};

export function UptimeMetrics({ data }: { data: UptimeData }) {
  const s = UPTIME_STATUS[data.status];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="flex flex-col justify-center p-5">
        <p className="text-sm font-medium text-muted">Current status</p>
        <div className="mt-2">
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
      </Card>
      <StatCard
        label={`Uptime (${data.window_days}d)`}
        value={data.uptime_pct === null ? "—" : data.uptime_pct.toFixed(1)}
        unit={data.uptime_pct === null ? undefined : "%"}
        accent={
          data.uptime_pct === null
            ? "text-ink"
            : data.uptime_pct >= 99.9
              ? "text-accent-green"
              : data.uptime_pct >= 99
                ? "text-accent-orange"
                : "text-accent-magenta"
        }
      />
      <StatCard
        label="Avg response"
        value={data.avg_response_ms ?? "—"}
        unit={data.avg_response_ms !== null ? "ms" : undefined}
      />
    </div>
  );
}

// ------------------------------------------------------------ Incident list

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
    return (
      <Card className="p-5 text-sm text-muted">No incidents recorded. All clear.</Card>
    );
  }
  return (
    <Card className="divide-y divide-line p-0">
      {incidents.map((i, idx) => {
        const open = !i.resolved_at;
        return (
          <div key={idx} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-3">
              <Badge tone={open ? "magenta" : "neutral"}>
                {open ? "Ongoing" : "Resolved"}
              </Badge>
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

// -------------------------------------------------------- Composed per-service

/**
 * One service's block: title, "Demo data" badge for the stubbed traffic
 * provider, an optional last-updated stamp, and the matching StatCards. Shared
 * by the authed detail page and the public white-label dashboard so numbers
 * render identically in both.
 */
export function ServiceMetricBlock({
  type,
  data,
  capturedAt,
  accentColor,
}: {
  type: ServiceType;
  data: unknown;
  capturedAt?: string;
  accentColor?: string;
}) {
  const meta = SERVICE_META[type];
  const isDemo = type === "traffic" && Boolean((data as TrafficData | null)?.demo);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-ink" style={accentColor ? { color: accentColor } : undefined}>
            {meta.label}
          </h3>
          {isDemo && <Badge tone="orange">Demo data</Badge>}
        </div>
        {capturedAt && (
          <span className="text-xs text-muted">Updated {timeAgo(capturedAt)}</span>
        )}
      </div>
      <div className="mt-3">
        {!data ? (
          <Card className="p-6 text-sm text-muted">
            No data yet — run “Refresh metrics”.
          </Card>
        ) : type === "page_speed" ? (
          <PageSpeedMetrics data={data as PageSpeedData} />
        ) : type === "security" ? (
          <SecurityMetrics data={data as SecurityData} />
        ) : type === "uptime" ? (
          <UptimeMetrics data={data as UptimeData} />
        ) : (
          <TrafficMetrics data={data as TrafficData} />
        )}
      </div>
    </section>
  );
}
