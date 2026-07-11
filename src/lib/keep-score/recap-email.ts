import "server-only";
import type { RecapData, RecapSite } from "./recap";
import { normalizeHex, readableText, safeAccent } from "@/lib/color";

// Email-safe HTML (inline styles + table layout — clients strip <style>/classes).
// Light canvas for deliverability; keep-green is the reward color, the green-week
// grid is the hero. White-label: the agency's logo + brand color lead the header,
// so a forwarded recap reads as theirs.

const KEEP = "#1f8a4c"; // deep keep-green (readable on white)
const KEEP_BRIGHT = "#35c46a";
const AMBER = "#c77d0a";
const RED = "#e5484d";
const INK = "#0e213d";
const MUTED = "#757575";
const LINE = "#e5e5e5";
const GRID_EMPTY = "#e9edf1";

const GRID_FILL: Record<string, string> = {
  green: KEEP_BRIGHT,
  amber: "#f5a524",
  red: RED,
  none: GRID_EMPTY,
};

function scoreHex(score: number | null): string {
  if (score == null) return MUTED;
  if (score >= 90) return KEEP;
  if (score >= 70) return AMBER;
  return RED;
}

/** 12-week grid as a fixed-cell table (email-safe equivalent of the div grid). */
function gridHtml(site: RecapSite): string {
  const cells = site.overview.weeks
    .map(
      (w) =>
        `<td width="14" height="14" style="width:14px;height:14px;padding:0;background:${GRID_FILL[w.status] ?? GRID_EMPTY};border-radius:3px;">&nbsp;</td>` +
        `<td width="3" style="width:3px;padding:0;">&nbsp;</td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>${cells}</tr></table>`;
}

function streakLine(site: RecapSite): string {
  const { streak, incidentFreeDays: days } = site.overview;
  if (streak.chainWeeks > 0) {
    const weeks = `${streak.chainWeeks} consecutive green week${streak.chainWeeks === 1 ? "" : "s"}`;
    if (days == null) return `No incidents yet · ${weeks}`;
    return `${days} day${days === 1 ? "" : "s"} without an incident · ${weeks}`;
  }
  if (streak.brokeRecently) {
    return `New chain started · previous best ${streak.previousBest} week${streak.previousBest === 1 ? "" : "s"}`;
  }
  return "Monitoring — first weeks incoming";
}

function deltaHtml(delta: number | null): string {
  if (delta == null || delta === 0) return "";
  const up = delta > 0;
  const color = up ? KEEP : RED;
  const arrow = up ? "▲" : "▼";
  return ` <span style="font:600 12px Arial,sans-serif;color:${color};">${arrow} ${Math.abs(delta)}</span>`;
}

function siteRow(site: RecapSite, publicUrl: string): string {
  const color = scoreHex(site.overview.keepScore);
  return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid ${LINE};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top">
              <div style="font:700 15px/1.2 Arial,sans-serif;color:${INK};">${site.name}</div>
              <div style="margin-top:2px;font:400 12px/1.2 Arial,sans-serif;color:${MUTED};">${site.url.replace(/^https?:\/\//, "")}</div>
            </td>
            <td valign="top" align="right" width="80">
              <div style="font:700 26px/1 Arial,sans-serif;color:${color};">${site.overview.keepScore ?? "—"}${deltaHtml(site.delta)}</div>
              <div style="margin-top:2px;font:500 10px/1 Arial,sans-serif;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;">Keep Score</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:12px;">${gridHtml(site)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:8px;font:400 12px/1.3 Arial,sans-serif;color:${MUTED};">
              ${streakLine(site)} · <a href="${publicUrl}" style="color:${KEEP};text-decoration:none;">View dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** The one-line reward that leads the email + becomes the subject. */
function headline(data: RecapData): string {
  const { rollup } = data;
  if (rollup.allGreen) {
    return rollup.siteCount === 1
      ? "Your site stayed healthy all week"
      : `All ${rollup.siteCount} sites stayed healthy this week`;
  }
  if (rollup.incidentsResolved > 0) {
    return `${rollup.incidentsResolved} incident${rollup.incidentsResolved === 1 ? "" : "s"} resolved — ${rollup.healthy} of ${rollup.siteCount} sites green`;
  }
  if (rollup.healthy > 0) {
    return `${rollup.healthy} of ${rollup.siteCount} sites green this week`;
  }
  return "Your weekly Keep Score recap";
}

export type RecapEmail = { subject: string; html: string };

export function renderRecapEmail(data: RecapData, opts: { siteUrl: string }): RecapEmail {
  const accent = safeAccent(data.agency.brandColor ? normalizeHex(data.agency.brandColor) : KEEP);
  const onAccent = readableText(accent);
  const lead = headline(data);
  const settingsUrl = `${opts.siteUrl}/dashboard/settings`;

  const logo = data.agency.logoUrl
    ? `<img src="${data.agency.logoUrl}" alt="${data.agency.name}" height="28" style="height:28px;display:block;" />`
    : `<span style="font:700 18px Arial,sans-serif;color:${onAccent};">${data.agency.name}</span>`;

  const rows = data.sites
    .map((s) => siteRow(s, `${opts.siteUrl}/d/${s.slug}`))
    .join("");

  // Impact strip — the concrete things kept healthy this week.
  const impact = [
    data.rollup.avgScore != null ? `Average Keep Score ${data.rollup.avgScore}` : null,
    data.rollup.incidentsResolved > 0
      ? `${data.rollup.incidentsResolved} incident${data.rollup.incidentsResolved === 1 ? "" : "s"} resolved`
      : "No incidents this week",
    data.rollup.bestStreak > 0 ? `Best streak ${data.rollup.bestStreak} weeks` : null,
  ].filter(Boolean) as string[];

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};">
            <tr>
              <td style="background:${accent};padding:20px 28px;">${logo}</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <div style="font:400 13px/1.2 Arial,sans-serif;color:${MUTED};">${data.weekLabel}</div>
                <div style="margin-top:6px;font:700 22px/1.25 Arial,sans-serif;color:${INK};">${lead}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 4px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf7;border:1px solid #d8ecdf;border-radius:12px;">
                  <tr><td style="padding:12px 16px;font:500 13px/1.5 Arial,sans-serif;color:${KEEP};">
                    ${impact.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}
                  </td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <a href="${opts.siteUrl}/dashboard" style="display:inline-block;background:${accent};color:${onAccent};font:600 14px Arial,sans-serif;text-decoration:none;padding:11px 20px;border-radius:10px;">Open your dashboard</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid ${LINE};font:400 11px/1.5 Arial,sans-serif;color:${MUTED};">
                Sent by ${data.agency.name} via SiteKeep. <a href="${settingsUrl}" style="color:${MUTED};">Manage weekly recaps</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: `${lead} · ${data.weekLabel}`, html };
}
