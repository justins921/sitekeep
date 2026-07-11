"use client";

import { useState } from "react";
import { Badge, Card, DisclosureButton, StarRating } from "@/components/ui";
import { Gauge, GaugeLegend } from "@/components/charts/Gauge";
import { RiskMeter } from "@/components/charts/RiskMeter";
import { LineChart, ComparisonLegend } from "@/components/charts/LineChart";
import { type RiskLevel } from "@/lib/charts";
import { SERVICE_META, type ServiceType } from "@/lib/services";
import { normalizePageSpeed } from "@/lib/metrics/normalize";
import {
  cls,
  ms,
  rate,
  ratingAccent,
  secs,
  timeAgo,
  deltaDir,
  deltaTone,
  DELTA_ARROW,
  DELTA_TONE_CLASS,
} from "./format";
import type {
  A11yAudit,
  A11ySeverity,
  AccessibilityData,
  CoreWebVitals,
  GoogleBusinessData,
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
            (value === o.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")
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

function DeltaTag({
  delta,
  lowerIsBetter = false,
}: {
  delta?: TrafficDelta;
  lowerIsBetter?: boolean;
}) {
  if (!delta) return null;
  // Arrow follows the raw number movement; color follows whether that's good.
  const dir = deltaDir(delta.change_pct);
  const tone = deltaTone(delta.change_pct, lowerIsBetter);
  return (
    <span className={"text-xs font-medium " + DELTA_TONE_CLASS[tone]}>
      {DELTA_ARROW[dir]} {Math.abs(delta.change_pct)}%
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
              (data.https_enforced ? "text-accent-green" : "text-accent-red")
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
              <span className={ok ? "text-accent-green" : "text-accent-red"}>
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
                (sb.threats.length === 0 ? "text-accent-green" : "text-accent-red")
              }
            >
              {sb.threats.length === 0 ? "Clean" : `${sb.threats.length} threat(s)`}
            </p>
          </div>
          {sb.threats.length > 0 && (
            <div className="rounded-xl border border-line p-4">
              <p className="text-xs font-medium text-muted">Threat types</p>
              <p className="mt-1 text-sm font-medium text-accent-red">
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
            <Badge tone={data!.status === "up" ? "green" : "red"}>
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
                      : "text-accent-red")
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
            <div className="flex h-3 overflow-hidden rounded-full bg-fill-red">
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

function GscDeltaTag({
  delta,
  lowerIsBetter = false,
}: {
  delta?: GscDelta;
  lowerIsBetter?: boolean;
}) {
  if (!delta) return null;
  // Raw delta drives the arrow; goodness (with lower-is-better for position)
  // drives the color — so an improving position shows a green down-arrow.
  const dir = deltaDir(delta.change_pct);
  const tone = deltaTone(delta.change_pct, lowerIsBetter);
  return (
    <span className={"text-xs font-medium " + DELTA_TONE_CLASS[tone]}>
      {DELTA_ARROW[dir]} {Math.abs(delta.change_pct)}%
    </span>
  );
}

function GscTile({
  label,
  value,
  hint,
  delta,
  lowerIsBetter = false,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: GscDelta;
  lowerIsBetter?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-ink">{value}</span>
        <GscDeltaTag delta={delta} lowerIsBetter={lowerIsBetter} />
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
        {data.error ? (
          <>
            <p className="text-sm font-medium text-accent-red">
              Couldn&apos;t connect Search Console.
            </p>
            <p className="mt-1 text-sm text-muted">{data.error}</p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Search Console not connected. Add the service-account email as a user on
            the property and map it in settings to see clicks, impressions, and
            ranking positions.
          </p>
        )}
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
          lowerIsBetter
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

// --------------------------------------------------------- Accessibility

const SEV_META: Record<A11ySeverity, { label: string; dot: string; text: string }> = {
  serious: { label: "Serious", dot: "bg-accent-red", text: "text-accent-red" },
  moderate: { label: "Moderate", dot: "bg-accent-orange", text: "text-accent-orange" },
  minor: { label: "Minor", dot: "bg-faint", text: "text-muted" },
};

/** Legally-safe framing shown on every surface that renders the scan. */
const A11Y_DISCLAIMER =
  "Automated testing covers a portion of WCAG success criteria; full ADA / WCAG conformance requires manual expert review.";

function A11yFailRow({ a }: { a: A11yAudit }) {
  const sev = SEV_META[a.severity];
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={"inline-flex items-center gap-1.5 text-xs font-semibold " + sev.text}>
          <span className={"inline-block h-2 w-2 rounded-full " + sev.dot} />
          {sev.label}
        </span>
        <span className="text-sm font-semibold text-ink">{a.title}</span>
        {a.affected > 0 && (
          <span className="rounded-full bg-canvas-alt px-2 py-0.5 text-[11px] font-medium text-muted">
            {a.affected} element{a.affected === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {a.description && <p className="mt-1.5 text-sm text-body">{a.description}</p>}
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
        {a.wcag ?? a.group}
      </p>
    </li>
  );
}

export function AccessibilityCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: AccessibilityData;
  capturedAt?: string;
  accentColor?: string;
}) {
  const [showPassed, setShowPassed] = useState(false);

  return (
    <Card className="p-6">
      <CardHeader
        title="Accessibility"
        accentColor={accentColor}
        updated={capturedAt}
        badge={<Badge tone="green">WCAG 2.1 AA</Badge>}
      />
      <p className="-mt-3 mb-5 text-xs text-muted">Automated accessibility scan</p>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
        {data.score === null ? (
          <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border border-dashed border-line text-center">
            <span className="text-lg font-bold text-faint">—</span>
            <span className="mt-0.5 text-[10px] text-faint">awaiting</span>
          </div>
        ) : (
          <Gauge score={data.score} label="Score" />
        )}
        <div className="grid flex-1 grid-cols-2 gap-3">
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-muted">Checks passed</p>
            <p className="mt-1 text-2xl font-bold text-accent-green">{data.passed_count}</p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-muted">Checks failing</p>
            <p
              className={
                "mt-1 text-2xl font-bold " +
                (data.failed_count === 0 ? "text-accent-green" : "text-accent-red")
              }
            >
              {data.failed_count}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {data.failed.length === 0 ? (
          <p className="rounded-xl bg-fill-green px-4 py-3 text-sm font-medium text-accent-green">
            No automated accessibility failures detected.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Failing checks ({data.failed.length})
            </p>
            <ul className="grid gap-2">
              {data.failed.map((a) => (
                <A11yFailRow key={a.id} a={a} />
              ))}
            </ul>
          </>
        )}
      </div>

      {data.passed.length > 0 && (
        <div className="mt-4">
          <DisclosureButton open={showPassed} onClick={() => setShowPassed((v) => !v)}>
            {showPassed ? "Hide" : "Show"} {data.passed.length} passing check
            {data.passed.length === 1 ? "" : "s"}
          </DisclosureButton>
          {showPassed && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.passed.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="text-accent-green">✓</span>
                  <span className="text-body">{a.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-5 border-t border-line pt-4 text-xs text-muted">{A11Y_DISCLAIMER}</p>
    </Card>
  );
}

// ------------------------------------------------ Google Business Profile

export function GoogleBusinessCard({
  data,
  capturedAt,
  accentColor,
}: {
  data: GoogleBusinessData;
  capturedAt?: string;
  accentColor?: string;
}) {
  if (!data.connected) {
    return (
      <Card className="p-6">
        <CardHeader title="Google Business Profile" accentColor={accentColor} />
        <p className="text-sm text-muted">
          {data.error ??
            "Not connected. Add this client’s Google Business location in settings to show rating, reviews, and profile completeness."}
        </p>
      </Card>
    );
  }

  const pctColor =
    data.completeness_pct >= 80
      ? "text-accent-green"
      : data.completeness_pct >= 50
        ? "text-accent-orange"
        : "text-accent-red";
  const barColor =
    data.completeness_pct >= 80
      ? "bg-accent-green"
      : data.completeness_pct >= 50
        ? "bg-accent-orange"
        : "bg-accent-red";

  return (
    <Card className="p-6">
      <CardHeader
        title="Google Business Profile"
        accentColor={accentColor}
        updated={capturedAt}
        badge={data.demo ? <Badge tone="orange">Demo data</Badge> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">Rating</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-ink">
              {data.rating === null ? "—" : data.rating.toFixed(1)}
            </span>
            {data.rating !== null && <StarRating rating={Math.round(data.rating)} />}
          </div>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">Reviews</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {data.reviews_total === null ? "—" : data.reviews_total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-muted">Profile completeness</p>
          <p className={"mt-1 text-2xl font-bold " + pctColor}>{data.completeness_pct}%</p>
        </div>
      </div>

      {/* Completeness checklist */}
      {data.checklist.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-canvas-alt">
            <div className={"h-full rounded-full " + barColor} style={{ width: `${data.completeness_pct}%` }} />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.checklist.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-sm">
                <span className={c.ok ? "text-accent-green" : "text-accent-red"}>{c.ok ? "✓" : "✕"}</span>
                <span className="text-body">{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent reviews */}
      {data.reviews.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent reviews</p>
          <ul className="grid gap-3">
            {data.reviews.map((r, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating rating={Math.round(r.rating)} />
                  <span className="text-sm font-semibold text-ink">{r.author}</span>
                  {r.relative && <span className="text-xs text-muted">· {r.relative}</span>}
                </div>
                {r.text && <p className="mt-1.5 line-clamp-3 text-sm text-body">{r.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.maps_url && (
        <a
          href={data.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
        >
          View on Google Maps →
        </a>
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
  if (type === "accessibility") {
    return <AccessibilityCard data={data as AccessibilityData} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  if (type === "google_business") {
    return <GoogleBusinessCard data={data as GoogleBusinessData} capturedAt={capturedAt} accentColor={accentColor} />;
  }
  return <SecurityCard data={data as SecurityData} capturedAt={capturedAt} accentColor={accentColor} />;
}
