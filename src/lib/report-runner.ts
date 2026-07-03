import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isReportDue, type ReportRow } from "./reports";
import { renderReportEmail, type ReportEmailInput } from "./report-email";
import { getTrendSeries } from "./trends";
import { sendEmail } from "./email";
import type { ServiceType } from "./services";

export type ReportOutcome = {
  client: string;
  recipient: string;
  status: "sent" | "skipped" | "failed";
  error?: string;
};

export function periodLabel(cadence: "monthly" | "weekly", now: Date): string {
  const label = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return cadence === "weekly" ? `week of ${label}` : label;
}

/** Assemble the rendered email for one client from its latest snapshots. */
export async function buildReportEmail(
  supabase: SupabaseClient,
  report: ReportRow,
  now: Date,
) {
  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name, website_url, agency_id")
    .eq("id", report.client_id)
    .single();
  if (!client) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("name, brand_color, logo_url, alert_email, owner_id")
    .eq("id", client.agency_id)
    .single();
  if (!agency) return null;

  // White-label reply-to: the agency's contact email, falling back to the
  // owner's login email (best-effort; only resolvable with the service-role
  // client, which the cron uses). Client replies go here, not to SiteKeep.
  let replyTo: string | null = agency.alert_email ?? null;
  if (!replyTo) {
    try {
      const { data } = await supabase.auth.admin.getUserById(agency.owner_id as string);
      replyTo = data.user?.email ?? null;
    } catch {
      replyTo = null;
    }
  }

  const { data: svcRows } = await supabase
    .from("client_services")
    .select("service_type")
    .eq("client_id", report.client_id)
    .eq("enabled", true);
  const services = (svcRows ?? []).map((s) => s.service_type as ServiceType);

  const { data: snaps } = await supabase
    .from("metric_snapshots")
    .select("service_type, data, captured_at")
    .eq("client_id", report.client_id)
    .order("captured_at", { ascending: false });

  const metrics: Partial<Record<ServiceType, unknown>> = {};
  for (const s of snaps ?? []) {
    const t = s.service_type as ServiceType;
    if (!(t in metrics)) metrics[t] = s.data;
  }

  // Work performed in the current period (trailing ~31 days).
  const periodStart = new Date(now.getTime() - 31 * 86_400_000).toISOString();
  const { data: activityRows } = await supabase
    .from("activity_log")
    .select("title, description, category, performed_at")
    .eq("client_id", report.client_id)
    .gte("performed_at", periodStart)
    .order("performed_at", { ascending: false });

  const trends = await getTrendSeries(supabase, report.client_id);

  const rendered = renderReportEmail({
    agency,
    client,
    services,
    metrics,
    activity: (activityRows ?? []) as ReportEmailInput["activity"],
    trends,
    periodLabel: periodLabel(report.cadence, now),
  });
  // fromName = the agency, so the client sees them as the sender.
  return { ...rendered, fromName: agency.name as string, replyTo };
}

/**
 * Send every due report. Each client is isolated in its own try/catch, so one
 * failure never blocks the rest. On a successful (or key-less skipped) send we
 * stamp last_sent_at, which makes a re-run within the same period a no-op.
 * `supabase` must be a client that can read across agencies (service role).
 */
export async function runDueReports(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ processed: number; outcomes: ReportOutcome[] }> {
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("enabled", true);

  const outcomes: ReportOutcome[] = [];

  for (const report of (reports ?? []) as ReportRow[]) {
    if (!isReportDue(report, now)) continue;
    const recipient = report.recipient_email ?? "";
    try {
      const email = await buildReportEmail(supabase, report, now);
      if (!email) {
        outcomes.push({ client: report.client_id, recipient, status: "failed", error: "client not found" });
        continue;
      }

      const res = await sendEmail({
        to: recipient,
        subject: email.subject,
        html: email.html,
        fromName: email.fromName,
        replyTo: email.replyTo,
      });
      if (res.ok) {
        await supabase
          .from("reports")
          .update({ last_sent_at: now.toISOString() })
          .eq("id", report.id);
        outcomes.push({
          client: report.client_id,
          recipient,
          status: res.skipped ? "skipped" : "sent",
        });
      } else {
        outcomes.push({ client: report.client_id, recipient, status: "failed", error: res.error });
      }
    } catch (err) {
      outcomes.push({
        client: report.client_id,
        recipient,
        status: "failed",
        error: err instanceof Error ? err.message : "unexpected error",
      });
    }
  }

  return { processed: outcomes.length, outcomes };
}
