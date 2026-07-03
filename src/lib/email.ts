import "server-only";
import { Resend } from "resend";

export type SendResult =
  | { ok: true; skipped?: false; id: string | null }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

/**
 * Sends an email via Resend. This is the ONLY key-dependent step in the report
 * flow: when RESEND_API_KEY is absent, we log and no-op (returning skipped) so
 * the whole pipeline — selection, rendering, marking sent — is testable without
 * a key.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL ?? "reports@sitekeep.com";

  if (!key) {
    console.info(
      `[email] RESEND_API_KEY absent — skipping send to ${opts.to} ("${opts.subject}"). ${opts.html.length} bytes rendered.`,
    );
    return { ok: true, skipped: true };
  }

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      // Surfaced in the UI, but also log so email problems (unverified sender,
      // sandbox recipient limits) are visible in the runtime logs.
      console.error(`[email] Resend rejected send from "${from}" to ${opts.to}: ${error.message}`);
      return { ok: false, error: error.message };
    }
    console.info(`[email] sent to ${opts.to} from "${from}" (id ${data?.id ?? "?"})`);
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    console.error(`[email] send threw for ${opts.to}: ${msg}`);
    return { ok: false, error: msg };
  }
}
