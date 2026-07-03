import "server-only";
import type { ServiceType } from "@/lib/services";
import { SERVICE_META } from "@/lib/services";
import type {
  PageSpeedData,
  SecurityData,
  TrafficData,
} from "@/lib/metrics/types";
import { cls, ms, rate, secs } from "@/components/metrics/format";
import { normalizeHex, readableText, safeAccent } from "@/lib/color";

// Email clients strip <style>/classes, so the report mirrors the dashboard's
// metric cards with inline styles + table layout (the email-safe equivalent).

const INK = "#0e213d";
const BODY = "#404040";
const MUTED = "#757575";
const LINE = "#e5e5e5";
const RATING_HEX: Record<string, string> = {
  good: "#6cad45",
  ni: "#e87c2e",
  poor: "#cb52cc",
  none: INK,
};

function scoreHex(score: number | null): string {
  if (score === null) return INK;
  if (score >= 90) return "#6cad45";
  if (score >= 50) return "#e87c2e";
  return "#cb52cc";
}

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

function pageSpeed(d: PageSpeedData): string {
  return row([
    card("Performance", d.performance_score?.toString() ?? "—", d.performance_score !== null ? "/100" : "", scoreHex(d.performance_score)),
    card("LCP", secs(d.lcp_ms), d.lcp_ms !== null ? "s" : "", RATING_HEX[rate("lcp", d.lcp_ms)]),
    card("CLS", cls(d.cls), "", RATING_HEX[rate("cls", d.cls)]),
  ]) + row([
    card("INP", ms(d.inp_ms), d.inp_ms !== null ? "ms" : "", RATING_HEX[rate("inp", d.inp_ms)]),
    card("FCP", secs(d.fcp_ms), d.fcp_ms !== null ? "s" : "", RATING_HEX[rate("fcp", d.fcp_ms)]),
    card("TBT", ms(d.tbt_ms), d.tbt_ms !== null ? "ms" : "", RATING_HEX[rate("tbt", d.tbt_ms)]),
  ]);
}

function security(d: SecurityData): string {
  const gradeText = { pass: "Secure", warn: "Needs attention", fail: "At risk" }[d.grade];
  const gradeColor = { pass: "#6cad45", warn: "#e87c2e", fail: "#cb52cc" }[d.grade];
  const present = Object.values(d.headers).filter(Boolean).length;
  return row([
    card("Overall", gradeText, "", gradeColor),
    card("HTTPS enforced", d.https_enforced ? "Yes" : "No", "", d.https_enforced ? "#6cad45" : "#cb52cc"),
    card("SSL expires in", d.ssl_days_to_expiry?.toString() ?? "—", d.ssl_days_to_expiry !== null ? "days" : "", INK),
  ]) + `<div style="font:500 12px Arial,sans-serif;color:${MUTED};padding:10px 6px 0;">Security headers present: ${present}/5</div>`;
}

function traffic(d: TrafficData): string {
  return row([
    card("Sessions", d.sessions.toLocaleString(), `(${d.trend_pct > 0 ? "+" : ""}${d.trend_pct}%)`, INK),
    card("Users", d.users.toLocaleString(), "", INK),
    card("Pageviews", d.pageviews.toLocaleString(), "", INK),
  ]);
}

function serviceSection(type: ServiceType, data: unknown): string {
  const meta = SERVICE_META[type];
  const isDemo = type === "traffic" && Boolean((data as TrafficData | null)?.demo);
  let body: string;
  if (!data) {
    body = `<div style="border:1px solid ${LINE};border-radius:14px;padding:16px;font:400 13px Arial,sans-serif;color:${MUTED};">No data captured yet.</div>`;
  } else if (type === "page_speed") body = pageSpeed(data as PageSpeedData);
  else if (type === "security") body = security(data as SecurityData);
  else body = traffic(data as TrafficData);

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
  periodLabel: string;
};

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
      : input.services.map((t) => serviceSection(t, input.metrics[t] ?? null)).join("");

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
        <tr><td style="padding:24px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;text-align:center;font:500 12px Arial,sans-serif;color:${BODY};">
            Maintained by ${input.agency.name}
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
