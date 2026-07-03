"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export type RequestFormState =
  | { ok: true }
  | { error: string }
  | null;

/**
 * Public "Request a change" submission from the white-label dashboard. Runs as
 * the anonymous server client and inserts strictly through the security-definer
 * RPC (validation + rate limit live in the DB). Never touches the table
 * directly and never uses the service role — this is an unauthenticated path.
 *
 * On success it fires an OPTIONAL notification to the agency's configured alert
 * email (returned by the RPC, used server-side only, never sent to the browser).
 * That send no-ops without RESEND_API_KEY.
 */
export async function submitRequestAction(
  slug: string,
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_client_request", {
    dashboard_slug: slug,
    req_title: title,
    req_description: description,
    req_email: email,
  });

  if (error) return { error: "Something went wrong. Please try again." };
  const result = data as { ok: boolean; error?: string; notify_email?: string | null };
  if (!result?.ok) return { error: result?.error ?? "Could not submit your request." };

  const notify = result.notify_email;
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `New request from your ${slug} dashboard`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="font:700 18px Arial,sans-serif;color:#0e213d;margin:0 0 12px;">New change request</h2>
        <p style="font:600 14px Arial,sans-serif;color:#0e213d;margin:0 0 4px;">${escapeHtml(title.trim())}</p>
        ${description.trim() ? `<p style="font:400 14px Arial,sans-serif;color:#404040;margin:0 0 12px;">${escapeHtml(description.trim())}</p>` : ""}
        <p style="font:400 12px Arial,sans-serif;color:#757575;">From: ${email.trim() ? escapeHtml(email.trim()) : "anonymous"}</p>
      </div>`,
    });
  }

  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
