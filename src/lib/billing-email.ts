import "server-only";
import type { BillingInterval, Plan } from "./plans";

// Day-12 trial reminder — email-safe HTML (inline styles + tables). Plain, warm,
// no exclamation marks: what's continuing, when it charges, how to change plan.

const KEEP = "#1f8a4c";
const BRAND = "#2f6fe0";
const INK = "#0e213d";
const BODY = "#404040";
const MUTED = "#757575";
const LINE = "#e5e5e5";

export type TrialReminderInput = {
  agencyName: string;
  plan: Plan;
  interval: BillingInterval;
  daysLeft: number;
  trialEnd: string | null;
  siteUrl: string;
  now: Date;
};

export function renderTrialReminderEmail(input: TrialReminderInput): {
  subject: string;
  html: string;
} {
  const price = input.plan.price[input.interval];
  const per = input.interval === "year" ? "year" : "month";
  const endDate = input.trialEnd
    ? new Date(input.trialEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
  const when =
    input.daysLeft <= 0
      ? "today"
      : input.daysLeft === 1
        ? "tomorrow"
        : `in ${input.daysLeft} days`;

  const subject = `Your SiteKeep trial ends ${when}`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#ffffff;border-radius:16px;border:1px solid ${LINE};overflow:hidden;">
          <tr><td style="padding:28px 28px 8px;">
            <div style="font:700 20px/1.3 Arial,sans-serif;color:${INK};">Your trial ends ${when}</div>
            <p style="margin:12px 0 0;font:400 14px/1.6 Arial,sans-serif;color:${BODY};">
              Your ${input.plan.name} trial keeps every site you added under continuous monitoring —
              Keep Score, uptime, SSL and weekly recaps. ${
                endDate
                  ? `On ${endDate} your card is charged $${price} per ${per} and monitoring continues without interruption.`
                  : `When it ends your card is charged $${price} per ${per} and monitoring continues.`
              }
            </p>
          </td></tr>
          <tr><td style="padding:12px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6faf7;border:1px solid #d8ecdf;border-radius:12px;">
              <tr><td style="padding:14px 16px;font:600 14px/1.4 Arial,sans-serif;color:${KEEP};">
                ${input.plan.name} · $${price}/${per} · up to ${input.plan.siteCap} site${input.plan.siteCap === 1 ? "" : "s"}
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:20px 28px;">
            <a href="${input.siteUrl}/dashboard/billing" style="display:inline-block;background:${BRAND};color:#ffffff;font:600 14px Arial,sans-serif;text-decoration:none;padding:11px 20px;border-radius:10px;">Review your plan</a>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid ${LINE};font:400 12px/1.6 Arial,sans-serif;color:${MUTED};">
            Want a different plan, or to cancel before the charge? You can switch or cancel any time from
            <a href="${input.siteUrl}/dashboard/billing" style="color:${MUTED};">billing</a>. Sent by SiteKeep for ${input.agencyName}.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
