import { Badge, Card, StatCard } from "@/components/ui";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import type {
  PageSpeedData,
  SecurityData,
  TrafficData,
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
        ) : (
          <TrafficMetrics data={data as TrafficData} />
        )}
      </div>
    </section>
  );
}
