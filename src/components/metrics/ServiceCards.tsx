"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { Gauge, GaugeLegend } from "@/components/charts/Gauge";
import { RiskMeter } from "@/components/charts/RiskMeter";
import { LineChart, ComparisonLegend } from "@/components/charts/LineChart";
import { type RiskLevel } from "@/lib/charts";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import { normalizePageSpeed } from "@/lib/metrics/normalize";
import { cls, ms, rate, ratingAccent, secs, timeAgo } from "./format";
import type {
  CoreWebVitals,
  GscDelta,
  PageSpeedData,
  PageSpeedStrategyData,
  SearchConsoleData,
  SecurityData,
  TrafficData,
  TrafficDelta,
  UptimeData,
} from "@/lib/metrics/types";

// ---------------------------------------------------------------- shared

function CardHeader({
  title,
  accentColor,
  updated,
  right,
  badge,
}: {
  title: string;
  accentColor?: string;
  updated?: string;
  right?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-ink" style={accentColor ? { color: accentColor } : undefined}>
          {title}
        </h3>
        {badge}
        {updated && <span className="text-xs text-muted">· {timeAgo(updated)}</span>}
      </div>
      {right}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-canvas-alt p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={
            "rounded-md px-3 py-1 text-xs font-medium transition-colors " +
            (value === o.value ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- Page Speed

const CWV: Array<[keyof CoreWebVitals, string, (v: number | null) => string, string]> = [
  ["lcp_ms", "LCP", secs, "lcp"],
  ["inp_ms", "INP", ms, "inp"],
  ["cls", "CLS", cls, "cls"],
  ["fcp_ms", "FCP", secs, "fcp"],
  ["tbt_ms", "TBT", ms, "tbt"],
];

export function PageSpeedCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: PageSpeedData;
  capturedAt?: string;
  accentColor?: string;
}) {
  const has = { desktop: !!data.desktop, mobile: !!data.mobile };
  const [strategy, setStrategy] = useState<"desktop" | "mobile">(
    has.mobile ? "mobile" : "desktop",
  );
  const s = data[strategy] ?? data.mobile ?? data.desktop;

  const cats: Array<[keyof PageSpeedStrategyData["categories"], string]> = [
    ["performance", "Performance"],
    ["accessibility", "Accessibility"],
    ["best_practices", "Best Practices"],
    ["seo", "SEO"],
  ];

  return (
    <Card className="p-6">
      <CardHeader
        title="Page Speed"
        accentColor={accentColor}
        updated={capturedAt}
        right={
          <Segmented
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: "mobile", label: "Mobile" },
              { value: "desktop", label: "Desktop" },
            ]}
          />
        }
      />
      {!s ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cats.map(([key, label]) =>
              s.categories[key] === null ? (
                <div key={key} className="flex flex-col items-center">
                  <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border border-dashed border-line text-center">
                    <span className="text-lg font-bold text-faint">—</span>
                    <span className="mt-0.5 text-[10px] text-faint">awaiting</span>
                  </div>
                  <span className="mt-1.5 text-xs font-medium text-muted">{label}</span>
                </div>
              ) : (
                <div key={key} className="flex justify-center">
                  <Gauge score={s.categories[key]} label={label} />
                </div>
              ),
            )}
          </div>
          <div className="mt-5 flex justify-center">
            <GaugeLegend />
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Core Web Vitals
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {CWV.map(([key, label, fmt, ratingKey]) => {
                const v = s.cwv[key];
                const r = rate(ratingKey as "lcp", v);
                return (
                  <div key={key} className="rounded-xl border border-line px-3 py-2.5">
                    <p className="text-xs font-medium text-muted">{label}</p>
                    <p className={"mt-1 text-lg font-bold " + ratingAccent[r]}>
                      {fmt(v)}
                      {key === "lcp_ms" || key === "fcp_ms"
                        ? v !== null && <span className="text-xs font-medium text-muted">s</span>
                        : (key === "inp_ms" || key === "tbt_ms") &&
                          v !== null && <span className="text-xs font-medium text-muted">ms</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Traffic

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}m ${r}s`;
}

function DeltaTag({ delta }: { delta?: TrafficDelta }) {
  if (!delta) return null;
  const up = delta.change_pct > 0;
  const flat = delta.change_pct === 0;
  const color = flat ? "text-muted" : up ? "text-accent-green" : "text-accent-magenta";
  return (
    <span className={"text-xs font-medium " + color}>
      {up ? "↑" : flat ? "→" : "↓"} {Math.abs(delta.change_pct)}%
    </span>
  );
}

function Tile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: TrafficDelta;
}) {
  const empty = value === "—";
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className={"text-2xl font-bold " + (empty ? "text-faint" : "text-ink")}>{value}</span>
        {!empty && <DeltaTag delta={delta} />}
      </div>
      {empty && <p className="mt-0.5 text-[11px] text-faint">awaiting data</p>}
    </div>
  );
}

export function TrafficCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: TrafficData;
  capturedAt?: string;
  accentColor?: string;
}) {
  const [metric, setMetric] = useState<"users" | "new_users">("users");
  const color = accentColor ?? "#0068ff";
  const daily = data.daily ?? [];
  const dailyPrev = data.daily_prev ?? [];
  const current = daily.map((d) => (metric === "users" ? d.users : d.new_users));
  const preceding = dailyPrev.map((d) => (metric === "users" ? d.users : d.new_users));
  const dates = daily.map((d) => d.date);

  return (
    <Card className="p-6">
      <CardHeader
        title="Traffic"
        accentColor={accentColor}
        updated={capturedAt}
        badge={data.demo ? <Badge tone="orange">Demo data</Badge> : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Users" value={data.users.toLocaleString()} delta={data.deltas?.users} />
        <Tile
          label="New users"
          value={data.new_users === undefined ? "—" : data.new_users.toLocaleString()}
          delta={data.deltas?.new_users}
        />
        <Tile
          label="Engagement rate"
          value={data.engagement_rate === undefined ? "—" : `${data.engagement_rate.toFixed(1)}%`}
          delta={data.deltas?.engagement_rate}
        />
        <Tile
          label="Avg engagement"
          value={data.avg_engagement_time === undefined ? "—" : fmtDuration(data.avg_engagement_time)}
          delta={data.deltas?.avg_engagement_time}
        />
      </div>

      {current.length >= 2 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Website traffic</p>
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: "users", label: "Users" },
                { value: "new_users", label: "New Users" },
              ]}
            />
          </div>
          <LineChart
            current={current}
            preceding={preceding}
            dates={dates}
            color={color}
            currentLabel={`Last ${data.range_days} days`}
            precedingLabel={`Preceding ${data.range_days} days`}
          />
          <div className="mt-2">
            <ComparisonLegend
              color={color}
              currentLabel={`Last ${data.range_days} days`}
              precedingLabel={`Preceding ${data.range_days} days`}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

// --------------------------------------------------------------- Security

const HEADER_LABELS: Array<[keyof SecurityData["headers"], string]> = [
  ["hsts", "HSTS"],
  ["csp", "Content-Security-Policy"],
  ["x_frame_options", "X-Frame-Options"],
  ["x_content_type_options", "X-Content-Type-Options"],
  ["referrer_policy", "Referrer-Policy"],
];

export function SecurityCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: SecurityData;
  capturedAt?: string;
  accentColor?: string;
}) {
  const present = HEADER_LABELS.filter(([k]) => data.headers[k]).length;
  const risk: RiskLevel = data.risk_level ?? "medium";
  const sb = data.safe_browsing;

  return (
    <Card className="p-6">
      <CardHeader title="Security" accentColor={accentColor} updated={capturedAt} />
      <RiskMeter level={risk} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">HTTPS enforced</p>
          <p
            className={
              "mt-1 text-lg font-bold " +
              (data.https_enforced ? "text-accent-green" : "text-accent-magenta")
            }
          >
            {data.https_enforced ? "Yes" : "No"}
          </p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">SSL expires in</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {data.ssl_days_to_expiry ?? "—"}
            {data.ssl_days_to_expiry !== null && (
              <span className="text-xs font-medium text-muted"> days</span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">Security headers</p>
          <p
            className={
              "mt-1 text-lg font-bold " +
              (present >= 4 ? "text-accent-green" : "text-accent-orange")
            }
          >
            {present}/{HEADER_LABELS.length}
          </p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {HEADER_LABELS.map(([key, label]) => {
          const ok = data.headers[key];
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <span className={ok ? "text-accent-green" : "text-accent-magenta"}>
                {ok ? "✓" : "✕"}
              </span>
              <span className="text-body">{label}</span>
            </li>
          );
        })}
      </ul>

      {sb?.checked && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-muted">Malware / Safe Browsing</p>
            <p
              className={
                "mt-1 text-lg font-bold " +
                (sb.threats.length === 0 ? "text-accent-green" : "text-accent-magenta")
              }
            >
              {sb.threats.length === 0 ? "Clean" : `${sb.threats.length} threat(s)`}
            </p>
          </div>
          {sb.threats.length > 0 && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Threat types</p>
              <p className="mt-1 text-sm font-medium text-accent-magenta">
                {sb.threats.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {data.cert_issuer && (
        <p className="mt-4 text-xs text-muted">
          Certificate issued by {data.cert_issuer}
          {data.ssl_valid_to
            ? ` · valid to ${new Date(data.ssl_valid_to).toLocaleDateString()}`
            : ""}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Uptime

export function UptimeCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: UptimeData | null;
  capturedAt?: string;
  accentColor?: string;
}) {
  const empty = !data || data.status === "unknown" || data.checks === 0;

  return (
    <Card className="p-6">
      <CardHeader
        title="Uptime"
        accentColor={accentColor}
        updated={empty ? undefined : capturedAt}
        badge={
          empty ? undefined : (
            <Badge tone={data!.status === "up" ? "green" : "magenta"}>
              {data!.status === "up" ? "Operational" : "Down"}
            </Badge>
          )
        }
      />
      {empty ? (
        <p className="text-sm text-muted">
          Monitoring starts within ~5 minutes — data appears on the next check.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Uptime ({data!.window_days}d)</p>
              <p
                className={
                  "mt-1 text-2xl font-bold " +
                  ((data!.uptime_pct ?? 0) >= 99.9
                    ? "text-accent-green"
                    : (data!.uptime_pct ?? 0) >= 99
                      ? "text-accent-orange"
                      : "text-accent-magenta")
                }
              >
                {data!.uptime_pct === null ? "—" : data!.uptime_pct.toFixed(2)}
                <span className="text-sm font-medium text-muted">%</span>
              </p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Avg response</p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {data!.avg_response_ms ?? "—"}
                {data!.avg_response_ms !== null && (
                  <span className="text-sm font-medium text-muted"> ms</span>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Checks ({data!.window_days}d)</p>
              <p className="mt-1 text-2xl font-bold text-ink">{data!.checks}</p>
            </div>
          </div>

          {/* status-page-style bar: proportion up vs down over the window */}
          <div className="mt-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-fill-pink">
              <div
                className="h-full rounded-full bg-accent-green"
                style={{ width: `${Math.max(0, Math.min(100, data!.uptime_pct ?? 0))}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>{data!.window_days} days ago</span>
              <span style={accentColor ? { color: accentColor } : undefined}>
                {data!.last_check_at ? `last checked ${timeAgo(data!.last_check_at)}` : "now"}
              </span>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// --------------------------------------------------------- Search Console

function GscDeltaTag({ delta }: { delta?: GscDelta }) {
  if (!delta) return null;
  const up = delta.change_pct > 0;
  const flat = delta.change_pct === 0;
  // change_pct is already goodness-oriented (position is pre-inverted upstream),
  // so positive always means "better".
  const color = flat ? "text-muted" : up ? "text-accent-green" : "text-accent-magenta";
  return (
    <span className={"text-xs font-medium " + color}>
      {up ? "↑" : flat ? "→" : "↓"} {Math.abs(delta.change_pct)}%
    </span>
  );
}

function GscTile({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: GscDelta }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-ink">{value}</span>
        <GscDeltaTag delta={delta} />
      </div>
      {hint && <p className="mt-0.5 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

export function SearchConsoleCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: SearchConsoleData;
  capturedAt?: string;
  accentColor?: string;
}) {
  const color = accentColor ?? "#0068ff";

  if (!data.connected) {
    return (
      <Card className="p-6">
        <CardHeader title="Search / SEO" accentColor={accentColor} />
        <p className="text-sm text-muted">
          Search Console not connected. Add the service-account email as a user on
          the property and map it in settings to see clicks, impressions, and
          ranking positions.
        </p>
      </Card>
    );
  }

  const current = data.daily.map((d) => d.clicks);
  const preceding = data.daily_prev.map((d) => d.clicks);
  const dates = data.daily.map((d) => d.date);

  return (
    <Card className="p-6">
      <CardHeader title="Search / SEO" accentColor={accentColor} updated={capturedAt} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GscTile label="Clicks" value={data.clicks.toLocaleString()} delta={data.deltas.clicks} />
        <GscTile label="Impressions" value={data.impressions.toLocaleString()} delta={data.deltas.impressions} />
        <GscTile label="Avg CTR" value={`${data.ctr.toFixed(1)}%`} delta={data.deltas.ctr} />
        <GscTile
          label="Avg position"
          value={data.position.toFixed(1)}
          hint="lower is better"
          delta={data.deltas.position}
        />
      </div>

      {current.length >= 2 && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-ink">Search clicks</p>
          <LineChart
            current={current}
            preceding={preceding}
            dates={dates}
            color={color}
            currentLabel={`Last ${data.range_days} days`}
            precedingLabel={`Preceding ${data.range_days} days`}
          />
          <div className="mt-2">
            <ComparisonLegend
              color={color}
              currentLabel={`Last ${data.range_days} days`}
              precedingLabel={`Preceding ${data.range_days} days`}
            />
          </div>
        </div>
      )}

      {data.top_queries.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Top queries</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 font-medium">Query</th>
                  <th className="pb-2 text-right font-medium">Clicks</th>
                  <th className="pb-2 text-right font-medium">Impr.</th>
                  <th className="pb-2 text-right font-medium">CTR</th>
                  <th className="pb-2 text-right font-medium">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {data.top_queries.map((q, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="max-w-[220px] truncate py-2 pr-3 text-ink">{q.query}</td>
                    <td className="py-2 text-right font-medium text-ink">{q.clicks.toLocaleString()}</td>
                    <td className="py-2 text-right text-muted">{q.impressions.toLocaleString()}</td>
                    <td className="py-2 text-right text-muted">{q.ctr.toFixed(1)}%</td>
                    <td className="py-2 text-right text-muted">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------- dispatcher

function EmptyCard({ title, accentColor }: { title: string; accentColor?: string }) {
  return (
    <Card className="p-6">
      <CardHeader title={title} accentColor={accentColor} />
      <p className="text-sm text-muted">No data yet — run “Refresh metrics”.</p>
    </Card>
  );
}

/** Render the redesigned card for a service. Shared by detail + public. */
export function ServiceCard({
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
  if (type === "uptime") {
    return <UptimeCard data={(data as UptimeData) ?? null} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  if (data == null) {
    return <EmptyCard title={SERVICE_META[type].label} accentColor={accentColor} />;
  }
  if (type === "page_speed") {
    return <PageSpeedCard data={normalizePageSpeed(data)} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  if (type === "traffic") {
    return <TrafficCard data={data as TrafficData} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  if (type === "search_console") {
    return <SearchConsoleCard data={data as SearchConsoleData} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  return <SecurityCard data={data as SecurityData} capturedAt={capturedAt} accentColor={accentColor} />;
}
