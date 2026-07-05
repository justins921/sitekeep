import "server-only";
import type { ServiceType } from "@/lib/services";
import { SERVICE_META } from "@/lib/services";
import type { SearchConsoleData, SecurityData, TrafficData, UptimeData } from "@/lib/metrics/types";
import { cls, ms, rate, secs } from "@/components/metrics/format";
import { normalizeHex, readableText, safeAccent } from "@/lib/color";
import { sparklineSvg } from "@/lib/sparkline";
import { gaugeSvg, comparisonLineSvg, RISK_META } from "@/lib/charts";
import { normalizePageSpeed } from "@/lib/metrics/normalize";
import { TREND_KEYS, TREND_META, type TrendSeries } from "@/lib/trends";

// Email clients strip <style>/classes, so the report mirrors the dashboard's
// metric cards with inline styles + table layout (the email-safe equivalent).

const INK = "#0e213d";
const BODY = "#404040";
const MUTED = "#757575";
const LINE = "#e5e5e5";
const RATING_HEX: Record<string, string> = {
  good: "#6cad45",
  ni: "#e87c2e",
  poor: "#e5484d",
  none: INK,
};

function card(label: string, value: string, unit: string, color: string): string {
  return `
    <td style="padding:6px;" valign="top" width="33%">
      <div style="border:1px solid ${LINE};border-radius:14px;padding:14px 16px;">
        <div style="font:500 12px/1.2 Arial,sans-serif;color:${MUTED};">${label}</div>
        <div style="margin-top:6px;font:700 22px/1.1 Arial,sans-serif;color:${color};">
          ${value}<span style="font:500 12px Arial,sans-serif;color:${MUTED};"> ${unit}</span>
        </div>
      </div>
    </td>`;
}

function row(cells: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px;"><tr>${cells.join("")}</tr></table>`;
}

function gaugeCell(label: string, score: number | null): string {
  return `<td align="center" valign="top" width="25%" style="padding:6px;">
    ${gaugeSvg(score, { size: 84 })}
    <div style="font:500 12px Arial,sans-serif;color:${MUTED};margin-top:2px;">${label}</div>
  </td>`;
}

function pageSpeed(raw: unknown): string {
  const d = normalizePageSpeed(raw);
  const s = d.mobile ?? d.desktop;
  if (!s) return `<div style="font:400 13px Arial,sans-serif;color:${MUTED};">No data captured yet.</div>`;
  const c = s.categories;
  const gauges = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${gaugeCell("Performance", c.performance)}
    ${gaugeCell("Accessibility", c.accessibility)}
    ${gaugeCell("Best Practices", c.best_practices)}
    ${gaugeCell("SEO", c.seo)}
  </tr></table>`;
  const vitals =
    row([
      card("LCP", secs(s.cwv.lcp_ms), s.cwv.lcp_ms !== null ? "s" : "", RATING_HEX[rate("lcp", s.cwv.lcp_ms)]),
      card("INP", ms(s.cwv.inp_ms), s.cwv.inp_ms !== null ? "ms" : "", RATING_HEX[rate("inp", s.cwv.inp_ms)]),
      card("CLS", cls(s.cwv.cls), "", RATING_HEX[rate("cls", s.cwv.cls)]),
    ]) +
    row([
      card("FCP", secs(s.cwv.fcp_ms), s.cwv.fcp_ms !== null ? "s" : "", RATING_HEX[rate("fcp", s.cwv.fcp_ms)]),
      card("TBT", ms(s.cwv.tbt_ms), s.cwv.tbt_ms !== null ? "ms" : "", RATING_HEX[rate("tbt", s.cwv.tbt_ms)]),
      card("", "", "", INK),
    ]);
  return gauges + `<div style="font:600 11px Arial,sans-serif;color:${MUTED};padding:12px 6px 4px;text-transform:uppercase;letter-spacing:.4px;">Core Web Vitals</div>` + vitals;
}

function security(d: SecurityData): string {
  const risk = RISK_META[d.risk_level ?? "medium"];
  const present = Object.values(d.headers).filter(Boolean).length;
  const sb =
    d.safe_browsing?.checked
      ? `<div style="font:500 12px Arial,sans-serif;color:${MUTED};padding:6px 6px 0;">Malware / Safe Browsing: ${d.safe_browsing.threats.length === 0 ? "Clean" : d.safe_browsing.threats.join(", ")}</div>`
      : "";
  return (
    row([
      card("Risk level", risk.label, "", risk.color),
      card("HTTPS enforced", d.https_enforced ? "Yes" : "No", "", d.https_enforced ? "#6cad45" : "#e5484d"),
      card("SSL expires in", d.ssl_days_to_expiry?.toString() ?? "—", d.ssl_days_to_expiry !== null ? "days" : "", INK),
    ]) +
    `<div style="font:500 12px Arial,sans-serif;color:${MUTED};padding:10px 6px 0;">Security headers present: ${present}/5</div>` +
    sb
  );
}

function traffic(d: TrafficData, accent: string): string {
  const tag = (delta?: { change_pct: number }) =>
    delta ? `(${delta.change_pct > 0 ? "+" : ""}${delta.change_pct}%)` : "";
  const tiles = row([
    card("Users", d.users.toLocaleString(), tag(d.deltas?.users), INK),
    card("New users", (d.new_users ?? 0).toLocaleString(), tag(d.deltas?.new_users), INK),
    card("Engagement", (d.engagement_rate ?? 0).toFixed(1), "%", INK),
  ]);
  const cur = (d.daily ?? []).map((p) => p.users);
  const prev = (d.daily_prev ?? []).map((p) => p.users);
  const chart = comparisonLineSvg(cur, prev, { color: accent });
  const chartBlock = chart
    ? `<div style="padding:12px 6px 0;">
        <div style="font:600 12px Arial,sans-serif;color:${INK};margin-bottom:6px;">Website traffic — users</div>
        ${chart}
        <div style="font:400 11px Arial,sans-serif;color:${MUTED};margin-top:4px;">Solid: last ${d.range_days} days · Dashed: preceding ${d.range_days} days</div>
      </div>`
    : "";
  return tiles + chartBlock;
}

function searchConsole(d: SearchConsoleData, accent: string): string {
  if (!d.connected) {
    return `<div style="border:1px solid ${LINE};border-radius:14px;padding:16px;font:400 13px Arial,sans-serif;color:${MUTED};">Search Console not connected.</div>`;
  }
  const tag = (delta?: { change_pct: number }) =>
    delta ? `(${delta.change_pct > 0 ? "+" : ""}${delta.change_pct}%)` : "";
  const tiles =
    row([
      card("Clicks", d.clicks.toLocaleString(), tag(d.deltas.clicks), INK),
      card("Impressions", d.impressions.toLocaleString(), tag(d.deltas.impressions), INK),
      card("Avg CTR", d.ctr.toFixed(1), "%", INK),
    ]) +
    row([
      card("Avg position", d.position.toFixed(1), tag(d.deltas.position), INK),
      card("", "", "", INK),
      card("", "", "", INK),
    ]);

  const chart = comparisonLineSvg(
    (d.daily ?? []).map((p) => p.clicks),
    (d.daily_prev ?? []).map((p) => p.clicks),
    { color: accent },
  );
  const chartBlock = chart
    ? `<div style="padding:12px 6px 0;">
        <div style="font:600 12px Arial,sans-serif;color:${INK};margin-bottom:6px;">Search clicks</div>
        ${chart}
        <div style="font:400 11px Arial,sans-serif;color:${MUTED};margin-top:4px;">Solid: last ${d.range_days} days · Dashed: preceding ${d.range_days} days</div>
      </div>`
    : "";

  const rows = (d.top_queries ?? [])
    .slice(0, 10)
    .map(
      (q) => `<tr>
        <td style="padding:6px 8px;font:400 12px Arial,sans-serif;color:${INK};border-bottom:1px solid ${LINE};">${escapeHtml(q.query)}</td>
        <td style="padding:6px 8px;font:600 12px Arial,sans-serif;color:${INK};text-align:right;border-bottom:1px solid ${LINE};">${q.clicks.toLocaleString()}</td>
        <td style="padding:6px 8px;font:400 12px Arial,sans-serif;color:${MUTED};text-align:right;border-bottom:1px solid ${LINE};">${q.impressions.toLocaleString()}</td>
        <td style="padding:6px 8px;font:400 12px Arial,sans-serif;color:${MUTED};text-align:right;border-bottom:1px solid ${LINE};">${q.ctr.toFixed(1)}%</td>
        <td style="padding:6px 8px;font:400 12px Arial,sans-serif;color:${MUTED};text-align:right;border-bottom:1px solid ${LINE};">${q.position.toFixed(1)}</td>
      </tr>`,
    )
    .join("");
  const queriesBlock = rows
    ? `<div style="padding:14px 6px 0;">
        <div style="font:600 11px Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Top queries</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 8px 4px;font:600 11px Arial,sans-serif;color:${MUTED};">Query</td>
            <td style="padding:0 8px 4px;font:600 11px Arial,sans-serif;color:${MUTED};text-align:right;">Clicks</td>
            <td style="padding:0 8px 4px;font:600 11px Arial,sans-serif;color:${MUTED};text-align:right;">Impr.</td>
            <td style="padding:0 8px 4px;font:600 11px Arial,sans-serif;color:${MUTED};text-align:right;">CTR</td>
            <td style="padding:0 8px 4px;font:600 11px Arial,sans-serif;color:${MUTED};text-align:right;">Pos.</td>
          </tr>
          ${rows}
        </table>
      </div>`
    : "";

  return tiles + chartBlock + queriesBlock;
}

function uptime(d: UptimeData): string {
  const statusText = { up: "Operational", down: "Down", unknown: "No data yet" }[d.status];
  const statusColor = { up: "#6cad45", down: "#e5484d", unknown: INK }[d.status];
  const incident = d.last_incident
    ? `<div style="font:500 12px Arial,sans-serif;color:${MUTED};padding:10px 6px 0;">Last incident: ${d.last_incident.type === "downtime" ? "Downtime" : "SSL expiring"} on ${new Date(d.last_incident.started_at).toLocaleDateString()}${d.last_incident.resolved_at ? " (resolved)" : " (ongoing)"}.</div>`
    : "";
  return (
    row([
      card("Status", statusText, "", statusColor),
      card("Uptime", d.uptime_pct === null ? "—" : d.uptime_pct.toFixed(1), d.uptime_pct === null ? "" : `% ${d.window_days}d`, INK),
      card("Avg response", d.avg_response_ms?.toString() ?? "—", d.avg_response_ms !== null ? "ms" : "", INK),
    ]) + incident
  );
}

function serviceSection(type: ServiceType, data: unknown, accent: string): string {
  const meta = SERVICE_META[type];
  const isDemo = type === "traffic" && Boolean((data as TrafficData | null)?.demo);
  let body: string;
  if (!data) {
    body = `<div style="border:1px solid ${LINE};border-radius:14px;padding:16px;font:400 13px Arial,sans-serif;color:${MUTED};">No data captured yet.</div>`;
  } else if (type === "page_speed") body = pageSpeed(data);
  else if (type === "security") body = security(data as SecurityData);
  else if (type === "uptime") body = uptime(data as UptimeData);
  else if (type === "search_console") body = searchConsole(data as SearchConsoleData, accent);
  else body = traffic(data as TrafficData, accent);

  return `
    <tr><td style="padding:20px 24px 0;">
      <div style="font:700 16px Arial,sans-serif;color:${INK};">
        ${meta.label}${isDemo ? ` <span style="font:500 11px Arial,sans-serif;color:#e87c2e;background:#fdf0f6;border-radius:99px;padding:2px 8px;">Demo data</span>` : ""}
      </div>
      <div style="margin-top:10px;">${body}</div>
    </td></tr>`;
}

export type ReportEmailInput = {
  agency: { name: string; brand_color: string; logo_url: string | null };
  client: { company_name: string; website_url: string };
  services: ServiceType[];
  metrics: Partial<Record<ServiceType, unknown>>;
  activity: Array<{
    title: string;
    description: string | null;
    category: string | null;
    performed_at: string;
  }>;
  annotations: Array<{
    annotation_date: string;
    label: string;
    description: string | null;
    category: string | null;
  }>;
  trends: TrendSeries;
  periodLabel: string;
  /** White-label footer: agency contact + a link to the public request form. */
  contactEmail?: string | null;
  publicUrl?: string | null;
};

/** Static inline-SVG trend charts (email-safe; no scripts). */
function trendsSection(trends: TrendSeries, services: ServiceType[]): string {
  const cells = TREND_KEYS.filter(
    (k) => services.includes(k) && (trends[k]?.length ?? 0) >= 2,
  )
    .map((k) => {
      const meta = TREND_META[k];
      const values = trends[k];
      const latest = values[values.length - 1];
      const svg = sparklineSvg(values, { color: meta.color, width: 160, height: 44 });
      return `
      <td style="padding:6px;" valign="top" width="33%">
        <div style="border:1px solid ${LINE};border-radius:14px;padding:14px 16px;">
          <div style="font:500 12px/1.2 Arial,sans-serif;color:${MUTED};">${meta.label}</div>
          <div style="margin-top:4px;font:700 18px/1.1 Arial,sans-serif;color:${INK};">${latest.toFixed(meta.digits)}${meta.unit}</div>
          <div style="margin-top:6px;">${svg ?? ""}</div>
        </div>
      </td>`;
    })
    .join("");

  if (!cells) return "";
  return `
    <tr><td style="padding:20px 24px 0;">
      <div style="font:700 16px Arial,sans-serif;color:${INK};">Trends</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px -6px 0;"><tr>${cells}</tr></table>
    </td></tr>`;
}

function annotationsSection(annotations: ReportEmailInput["annotations"]): string {
  if (!annotations || annotations.length === 0) return "";
  const items = annotations
    .map((a) => {
      const when = new Date(`${a.annotation_date}T12:00:00`).toLocaleDateString();
      return `<li style="font:400 13px Arial,sans-serif;color:${BODY};margin:0 0 6px;">
        <strong style="color:${INK};">${escapeHtml(a.label)}</strong>${a.description ? ` — ${escapeHtml(a.description)}` : ""}
        <span style="color:${MUTED};"> (${when})</span>
      </li>`;
    })
    .join("");
  return `
    <tr><td style="padding:12px 24px 0;">
      <div style="font:600 12px Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:.4px;">Notes this period</div>
      <ul style="margin:8px 0 0;padding-left:18px;">${items}</ul>
    </td></tr>`;
}

function activitySection(activity: ReportEmailInput["activity"]): string {
  if (!activity || activity.length === 0) return "";
  const items = activity
    .map(
      (a) => `
      <tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};">
        <div style="font:600 13px Arial,sans-serif;color:${INK};">${escapeHtml(a.title)}</div>
        ${a.description ? `<div style="font:400 13px Arial,sans-serif;color:${BODY};margin-top:2px;">${escapeHtml(a.description)}</div>` : ""}
        <div style="font:400 11px Arial,sans-serif;color:${MUTED};margin-top:2px;">${new Date(a.performed_at).toLocaleDateString()}</div>
      </td></tr>`,
    )
    .join("");
  return `
    <tr><td style="padding:20px 24px 0;">
      <div style="font:700 16px Arial,sans-serif;color:${INK};">What we did this period</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${items}</table>
    </td></tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderReportEmail(input: ReportEmailInput): {
  subject: string;
  html: string;
} {
  const brand = normalizeHex(input.agency.brand_color);
  const onBrand = readableText(brand);
  const accent = safeAccent(brand);

  const logo = input.agency.logo_url
    ? `<img src="${input.agency.logo_url}" width="36" height="36" alt="${input.agency.name}" style="border-radius:8px;background:#ffffff;vertical-align:middle;" />`
    : "";

  const sections =
    input.services.length === 0
      ? `<tr><td style="padding:24px;font:400 13px Arial,sans-serif;color:${MUTED};">No services are enabled for this dashboard.</td></tr>`
      : input.services.map((t) => serviceSection(t, input.metrics[t] ?? null, accent)).join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#fafafa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${LINE};">
        <tr><td style="background:${brand};padding:20px 24px;">
          <span style="vertical-align:middle;">${logo}</span>
          <span style="font:600 14px Arial,sans-serif;color:${onBrand};vertical-align:middle;margin-left:${logo ? "10px" : "0"};">${input.agency.name}</span>
        </td></tr>
        <tr><td style="padding:24px 24px 0;">
          <div style="font:700 22px Arial,sans-serif;color:${INK};">${input.client.company_name}</div>
          <a href="${input.client.website_url}" style="font:500 13px Arial,sans-serif;color:${accent};text-decoration:none;">${input.client.website_url}</a>
          <div style="font:400 13px Arial,sans-serif;color:${MUTED};margin-top:6px;">Maintenance report · ${input.periodLabel}</div>
        </td></tr>
        ${sections}
        ${trendsSection(input.trends, input.services)}
        ${annotationsSection(input.annotations)}
        ${activitySection(input.activity)}
        <tr><td style="padding:24px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;text-align:center;">
            <div style="font:600 13px Arial,sans-serif;color:${INK};">Maintained by ${input.agency.name}</div>
            ${input.contactEmail ? `<div style="font:400 12px Arial,sans-serif;color:${MUTED};margin-top:4px;"><a href="mailto:${input.contactEmail}" style="color:${MUTED};text-decoration:none;">${input.contactEmail}</a></div>` : ""}
            ${input.publicUrl ? `<div style="margin-top:8px;"><a href="${input.publicUrl}#request" style="font:600 12px Arial,sans-serif;color:${accent};text-decoration:none;">Report an issue →</a></div>` : ""}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    subject: `${input.client.company_name} — maintenance report (${input.periodLabel})`,
    html,
  };
}
