"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildReportEmail } from "@/lib/report-runner";
import { sendEmail } from "@/lib/email";
import type { ReportRow } from "@/lib/reports";

export type ReportSettingsState = { error: string } | { ok: true } | null;

export async function updateReportSettingsAction(
  clientId: string,
  _prev: ReportSettingsState,
  formData: FormData,
): Promise<ReportSettingsState> {
  const enabled = formData.get("enabled") === "on";
  const recipient_email = String(formData.get("recipient_email") ?? "").trim() || null;
  const sendDayRaw = Number(formData.get("send_day"));
  const send_day = Number.isFinite(sendDayRaw)
    ? Math.min(31, Math.max(1, Math.round(sendDayRaw)))
    : 1;

  if (enabled && !recipient_email) {
    return { error: "Add a recipient email to enable reports." };
  }

  const supabase = await createClient();
  // RLS (owns_client) scopes this to the owning agency. Unique on client_id.
  const { error } = await supabase
    .from("reports")
    .upsert(
      { client_id: clientId, enabled, send_day, recipient_email, cadence: "monthly" },
      { onConflict: "client_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}

export type TestSendResult =
  | { status: "sent" | "skipped" }
  | { status: "error"; error: string };

export async function sendTestReportAction(
  clientId: string,
): Promise<TestSendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const recipient = (report as ReportRow | null)?.recipient_email;
  if (!recipient) {
    return { status: "error", error: "Set and save a recipient email first." };
  }

  try {
    const email = await buildReportEmail(
      supabase,
      report as ReportRow,
      new Date(),
    );
    if (!email) return { status: "error", error: "Could not build the report." };
    const res = await sendEmail({
      to: recipient,
      subject: `[Test] ${email.subject}`,
      html: email.html,
    });
    if (!res.ok) return { status: "error", error: res.error };
    return { status: res.skipped ? "skipped" : "sent" };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Could not send test report.",
    };
  }
}
