import "server-only";
import { Resend } from "resend";

export type SendResult =
  | { ok: true; skipped?: false; id: string | null }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

// Strip characters that could break the RFC 5322 display-name / header.
function sanitizeName(name: string): string {
  return name.replace(/["\r\n<>]/g, "").trim().slice(0, 78);
}

/**
 * Sends an email via Resend. This is the ONLY key-dependent step in the report
 * flow: when RESEND_API_KEY is absent, we log and no-op (returning skipped) so
 * the whole pipeline — selection, rendering, marking sent — is testable without
 * a key.
 *
 * White-label: client-facing reports pass the agency's name as `fromName` and
 * the agency's contact address as `replyTo`, so the client sees the agency as
 * the sender and replies go to the agency — while the message still sends over
 * SiteKeep's verified Resend domain (REPORT_FROM_EMAIL).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string | null;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const address = process.env.REPORT_FROM_EMAIL ?? "reports@sitekeep.com";
  const from = opts.fromName ? `${sanitizeName(opts.fromName)} <${address}>` : address;

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
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
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
