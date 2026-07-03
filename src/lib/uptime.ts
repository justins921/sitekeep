import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectCertificate } from "@/lib/metrics/security";
import { sendEmail } from "@/lib/email";
import type { UptimeData, UptimeIncidentSummary } from "@/lib/metrics/types";

// Uptime + SSL-expiry monitoring. The cron path (service-role client) records
// checks, opens/resolves incidents with ONE alert per edge, and writes a rolling
// summary snapshot. The manual-refresh path records a check + snapshot only (no
// incidents/alerts). Alerts are the sole key-gated step (no-op without Resend).

const PING_TIMEOUT_MS = 12_000;
const WINDOW_DAYS = 30;
const SSL_WARN_DAYS = 14;
// Coalesce summary snapshots: reuse the latest one if it's under an hour old so
// 5-minute checks don't bloat metric_snapshots (which also feeds trend charts).
const SNAPSHOT_COALESCE_MS = 60 * 60 * 1000;

export type PingResult = { is_up: boolean; status_code: number | null; response_ms: number | null };

export type AgencyForAlert = {
  id: string;
  owner_id: string;
  name: string;
  alert_email: string | null;
};

/** GET the URL with a short timeout. "Up" = an HTTP response with status < 400. */
export async function pingUrl(url: string): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "SiteKeepBot/1.0 (+https://sitekeep.com)" },
    });
    return {
      is_up: res.status > 0 && res.status < 400,
      status_code: res.status,
      response_ms: Date.now() - started,
    };
  } catch {
    return { is_up: false, status_code: null, response_ms: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Ping the URL and log a uptime_checks row. Returns the ping result. */
export async function recordUptimeCheck(
  supabase: SupabaseClient,
  clientId: string,
  url: string,
): Promise<PingResult> {
  const result = await pingUrl(url);
  await supabase.from("uptime_checks").insert({
    client_id: clientId,
    is_up: result.is_up,
    status_code: result.status_code,
    response_ms: result.response_ms,
  });
  return result;
}

/** Compute the rolling uptime summary from the check log + latest incident. */
export async function buildUptimeSummary(
  supabase: SupabaseClient,
  clientId: string,
  now: Date,
): Promise<UptimeData> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data: checks } = await supabase
    .from("uptime_checks")
    .select("is_up, response_ms, checked_at")
    .eq("client_id", clientId)
    .gte("checked_at", since)
    .order("checked_at", { ascending: false });

  const rows = checks ?? [];
  const total = rows.length;
  const upCount = rows.filter((r) => r.is_up).length;
  const responses = rows
    .filter((r) => r.is_up && typeof r.response_ms === "number")
    .map((r) => r.response_ms as number);
  const avg_response_ms = responses.length
    ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length)
    : null;

  const { data: incident } = await supabase
    .from("incidents")
    .select("type, started_at, resolved_at")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    status: total === 0 ? "unknown" : rows[0].is_up ? "up" : "down",
    uptime_pct: total === 0 ? null : Math.round((upCount / total) * 1000) / 10,
    window_days: WINDOW_DAYS,
    checks: total,
    avg_response_ms,
    last_check_at: total ? (rows[0].checked_at as string) : null,
    last_incident: (incident as UptimeIncidentSummary | null) ?? null,
  };
}

/** Build the summary and persist it as a metric_snapshots 'uptime' row. */
export async function writeUptimeSnapshot(
  supabase: SupabaseClient,
  clientId: string,
  now: Date,
): Promise<UptimeData> {
  const summary = await buildUptimeSummary(supabase, clientId, now);

  const { data: latest } = await supabase
    .from("metric_snapshots")
    .select("id, captured_at")
    .eq("client_id", clientId)
    .eq("service_type", "uptime")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fresh =
    latest &&
    now.getTime() - new Date(latest.captured_at as string).getTime() < SNAPSHOT_COALESCE_MS;

  if (fresh) {
    await supabase
      .from("metric_snapshots")
      .update({ data: summary, captured_at: now.toISOString() })
      .eq("id", latest.id);
  } else {
    await supabase
      .from("metric_snapshots")
      .insert({ client_id: clientId, service_type: "uptime", data: summary });
  }
  return summary;
}

// -------------------------------------------------------------- incidents/alerts

type IncidentType = "downtime" | "ssl_expiring";

async function getOpenIncident(
  supabase: SupabaseClient,
  clientId: string,
  type: IncidentType,
): Promise<{ id: string; details: Record<string, unknown>; notified_at: string | null } | null> {
  const { data } = await supabase
    .from("incidents")
    .select("id, details, notified_at")
    .eq("client_id", clientId)
    .eq("type", type)
    .is("resolved_at", null)
    .maybeSingle();
  return (data as { id: string; details: Record<string, unknown>; notified_at: string | null }) ?? null;
}

/** Resolve the open incident of a type; returns the resolved row id, or null. */
async function resolveOpenIncident(
  supabase: SupabaseClient,
  clientId: string,
  type: IncidentType,
  now: Date,
): Promise<string | null> {
  const { data } = await supabase
    .from("incidents")
    .update({ resolved_at: now.toISOString() })
    .eq("client_id", clientId)
    .eq("type", type)
    .is("resolved_at", null)
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/** Resolve where downtime/SSL alerts go: the per-agency override, else owner. */
async function resolveAlertRecipient(
  supabase: SupabaseClient,
  agency: AgencyForAlert,
): Promise<string | null> {
  if (agency.alert_email) return agency.alert_email;
  try {
    const { data } = await supabase.auth.admin.getUserById(agency.owner_id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

function alertHtml(heading: string, lines: string[]): string {
  const body = lines.map((l) => `<p style="margin:0 0 8px;font:400 14px Arial,sans-serif;color:#404040;">${l}</p>`).join("");
  return `<div style="max-width:520px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;">
    <h2 style="font:700 18px Arial,sans-serif;color:#0e213d;margin:0 0 12px;">${heading}</h2>
    ${body}
    <p style="margin:16px 0 0;font:400 12px Arial,sans-serif;color:#757575;">You're receiving this because you monitor this site with SiteKeep.</p>
  </div>`;
}

/**
 * Send one internal alert to the agency (owner or override). Never throws; when
 * RESEND_API_KEY is unset the underlying send no-ops (returns skipped). We treat
 * a missing recipient / skipped send as "notified" so we don't retry each cron.
 */
async function sendAgencyAlert(
  supabase: SupabaseClient,
  agency: AgencyForAlert,
  subject: string,
  heading: string,
  lines: string[],
): Promise<void> {
  const to = await resolveAlertRecipient(supabase, agency);
  if (!to) return;
  await sendEmail({ to, subject, html: alertHtml(heading, lines) });
}

// ------------------------------------------------------------------ cron driver

type MonitoredClient = {
  id: string;
  company_name: string;
  website_url: string;
  agency_id: string;
};

/** Active clients with the 'uptime' service enabled, plus their agency. */
async function loadMonitoredClients(supabase: SupabaseClient): Promise<{
  clients: MonitoredClient[];
  agencies: Map<string, AgencyForAlert>;
}> {
  const { data: enabledRows } = await supabase
    .from("client_services")
    .select("client_id")
    .eq("service_type", "uptime")
    .eq("enabled", true);
  const ids = (enabledRows ?? []).map((r) => r.client_id as string);
  if (ids.length === 0) return { clients: [], agencies: new Map() };

  const { data: clients } = await supabase
    .from("clients")
    .select("id, company_name, website_url, agency_id")
    .in("id", ids)
    .eq("is_active", true);

  const list = (clients ?? []) as MonitoredClient[];
  const agencyIds = [...new Set(list.map((c) => c.agency_id))];
  const agencies = new Map<string, AgencyForAlert>();
  if (agencyIds.length) {
    const { data: rows } = await supabase
      .from("agencies")
      .select("id, owner_id, name, alert_email")
      .in("id", agencyIds);
    for (const a of (rows ?? []) as AgencyForAlert[]) agencies.set(a.id, a);
  }
  return { clients: list, agencies };
}

export type UptimeRunResult = {
  checked: number;
  opened: number;
  resolved: number;
  alerts: number;
};

/**
 * Per active uptime-enabled client: ping, log a check, drive the downtime
 * incident state machine (one alert on down, one on recovery), and refresh the
 * rolling snapshot. Service-role client only (reads across agencies).
 */
export async function runUptimeMonitoring(
  supabase: SupabaseClient,
  now: Date,
): Promise<UptimeRunResult> {
  const { clients, agencies } = await loadMonitoredClients(supabase);
  let checked = 0;
  let opened = 0;
  let resolved = 0;
  let alerts = 0;

  for (const client of clients) {
    const result = await recordUptimeCheck(supabase, client.id, client.website_url);
    checked++;
    const agency = agencies.get(client.agency_id);
    const open = await getOpenIncident(supabase, client.id, "downtime");

    if (!result.is_up && !open) {
      await supabase.from("incidents").insert({
        client_id: client.id,
        type: "downtime",
        details: { status_code: result.status_code, url: client.website_url },
        notified_at: now.toISOString(),
      });
      opened++;
      if (agency) {
        alerts++;
        await sendAgencyAlert(
          supabase,
          agency,
          `⚠️ ${client.company_name} is down`,
          `${client.company_name} appears to be down`,
          [
            `We couldn't reach <strong>${client.website_url}</strong>.`,
            result.status_code ? `HTTP status: ${result.status_code}.` : `No response (timeout or connection error).`,
            `We'll let you know as soon as it recovers.`,
          ],
        );
      }
    } else if (result.is_up && open) {
      await resolveOpenIncident(supabase, client.id, "downtime", now);
      resolved++;
      if (agency) {
        alerts++;
        await sendAgencyAlert(
          supabase,
          agency,
          `✅ ${client.company_name} is back up`,
          `${client.company_name} has recovered`,
          [`<strong>${client.website_url}</strong> is responding normally again.`],
        );
      }
    }

    await writeUptimeSnapshot(supabase, client.id, now);
  }

  return { checked, opened, resolved, alerts };
}

/**
 * Daily SSL-expiry sweep. `forceDaysToExpiry` overrides the live cert read
 * (the sandbox MITMs TLS, so tests inject a value). Opens/refreshes one
 * 'ssl_expiring' incident per client when the cert is within SSL_WARN_DAYS, with
 * a single alert; resolves it silently once healthy again.
 */
export async function runSslExpiryChecks(
  supabase: SupabaseClient,
  now: Date,
  opts: { forceDaysToExpiry?: number } = {},
): Promise<{ checked: number; opened: number; alerts: number }> {
  const { clients, agencies } = await loadMonitoredClients(supabase);
  let checked = 0;
  let opened = 0;
  let alerts = 0;

  for (const client of clients) {
    let days: number | null;
    if (typeof opts.forceDaysToExpiry === "number") {
      days = opts.forceDaysToExpiry;
    } else {
      try {
        const host = new URL(client.website_url).hostname;
        days = (await inspectCertificate(host)).daysToExpiry;
      } catch {
        days = null;
      }
    }
    checked++;
    if (days === null) continue;

    const agency = agencies.get(client.agency_id);
    const open = await getOpenIncident(supabase, client.id, "ssl_expiring");

    if (days < SSL_WARN_DAYS) {
      if (!open) {
        await supabase.from("incidents").insert({
          client_id: client.id,
          type: "ssl_expiring",
          details: { days_to_expiry: days },
          notified_at: now.toISOString(),
        });
        opened++;
        if (agency) {
          alerts++;
          await sendAgencyAlert(
            supabase,
            agency,
            `🔒 SSL for ${client.company_name} expires in ${days}d`,
            `SSL certificate expiring soon`,
            [
              `The certificate for <strong>${client.website_url}</strong> expires in <strong>${days} day${days === 1 ? "" : "s"}</strong>.`,
              `Renew it before then to avoid browser security warnings.`,
            ],
          );
        }
      } else {
        // Refresh the day count; only alert if we never notified for this incident.
        await supabase
          .from("incidents")
          .update({ details: { days_to_expiry: days } })
          .eq("id", open.id);
        if (!open.notified_at && agency) {
          alerts++;
          await sendAgencyAlert(
            supabase,
            agency,
            `🔒 SSL for ${client.company_name} expires in ${days}d`,
            `SSL certificate expiring soon`,
            [`The certificate for <strong>${client.website_url}</strong> expires in <strong>${days} days</strong>.`],
          );
          await supabase.from("incidents").update({ notified_at: now.toISOString() }).eq("id", open.id);
        }
      }
    } else if (open) {
      await resolveOpenIncident(supabase, client.id, "ssl_expiring", now);
    }
  }

  return { checked, opened, alerts };
}
