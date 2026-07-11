import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRecapData } from "./recap";
import { renderRecapEmail } from "./recap-email";
import { sendEmail } from "@/lib/email";

// Weekly recap dispatch. Runs from the daily cron but only fires on Mondays
// (UTC) and never twice in the same ISO week (guarded by agencies.last_recap_at).
// Each agency is isolated so one failure never blocks the rest. Needs a client
// that can read across agencies + resolve owner emails (service role).

export type RecapOutcome = {
  agency: string;
  recipient: string;
  status: "sent" | "skipped" | "failed" | "no-sites";
  error?: string;
};

/** Monday in UTC — the recap cadence. */
export function isMonday(now: Date): boolean {
  return now.getUTCDay() === 1;
}

/** True once per ISO week: no send, or the last send was before this Monday. */
function dueThisWeek(lastRecapAt: string | null, now: Date): boolean {
  if (!lastRecapAt) return true;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return new Date(lastRecapAt).getTime() < monday.getTime();
}

/** Resolve where the recap goes: agency contact, else the owner's login email. */
async function recapRecipient(
  supabase: SupabaseClient,
  agency: { alert_email: string | null; owner_id: string },
): Promise<string | null> {
  if (agency.alert_email) return agency.alert_email;
  try {
    const { data } = await supabase.auth.admin.getUserById(agency.owner_id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Build + send one agency's recap now (used by the cron and the test-send). */
export async function sendRecapForAgency(
  supabase: SupabaseClient,
  agencyId: string,
  recipient: string,
  now: Date,
): Promise<{ ok: boolean; skipped?: boolean; error?: string; empty?: boolean }> {
  const data = await buildRecapData(supabase, agencyId, now);
  if (!data) return { ok: true, empty: true };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { subject, html } = renderRecapEmail(data, { siteUrl });
  const res = await sendEmail({
    to: recipient,
    subject,
    html,
    fromName: data.agency.name,
  });
  if (res.ok) return { ok: true, skipped: Boolean(res.skipped) };
  return { ok: false, error: res.error };
}

/**
 * Send every due weekly recap. No-op on non-Mondays. Stamps last_recap_at on a
 * successful (or key-less skipped) send so a same-week re-run is a no-op.
 */
export async function runWeeklyRecaps(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ processed: number; outcomes: RecapOutcome[] }> {
  const outcomes: RecapOutcome[] = [];
  if (!isMonday(now)) return { processed: 0, outcomes };

  const { data: agencies } = await supabase
    .from("agencies")
    .select("id, name, alert_email, owner_id, weekly_recap_enabled, last_recap_at")
    .eq("weekly_recap_enabled", true);

  for (const agency of agencies ?? []) {
    if (!dueThisWeek(agency.last_recap_at as string | null, now)) continue;

    const recipient = await recapRecipient(supabase, {
      alert_email: agency.alert_email as string | null,
      owner_id: agency.owner_id as string,
    });
    if (!recipient) {
      outcomes.push({ agency: agency.id as string, recipient: "", status: "failed", error: "no recipient" });
      continue;
    }

    try {
      const res = await sendRecapForAgency(supabase, agency.id as string, recipient, now);
      if (res.empty) {
        outcomes.push({ agency: agency.id as string, recipient, status: "no-sites" });
        continue;
      }
      if (res.ok) {
        await supabase
          .from("agencies")
          .update({ last_recap_at: now.toISOString() })
          .eq("id", agency.id);
        outcomes.push({
          agency: agency.id as string,
          recipient,
          status: res.skipped ? "skipped" : "sent",
        });
      } else {
        outcomes.push({ agency: agency.id as string, recipient, status: "failed", error: res.error });
      }
    } catch (err) {
      outcomes.push({
        agency: agency.id as string,
        recipient,
        status: "failed",
        error: err instanceof Error ? err.message : "unexpected error",
      });
    }
  }

  return { processed: outcomes.length, outcomes };
}
