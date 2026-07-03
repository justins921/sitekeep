import "server-only";

export type ReportRow = {
  id: string;
  client_id: string;
  cadence: "monthly" | "weekly";
  send_day: number;
  recipient_email: string | null;
  enabled: boolean;
  last_sent_at: string | null;
};

/**
 * Key identifying the "current period" for a cadence. Monthly => YYYY-MM;
 * weekly => YYYY-Www (ISO week). A report is sent at most once per period.
 */
export function periodKey(cadence: "monthly" | "weekly", date: Date): string {
  const y = date.getUTCFullYear();
  if (cadence === "weekly") {
    // ISO week number (UTC).
    const d = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week =
      1 +
      Math.round(
        ((d.getTime() - firstThursday.getTime()) / 86_400_000 -
          3 +
          ((firstThursday.getUTCDay() + 6) % 7)) /
          7,
      );
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return `${y}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A report is due when it is enabled, its send_day matches today's day of the
 * month, and it has not already been sent in the current period. For months
 * shorter than send_day, the last day of the month counts (e.g. send_day 31 in
 * February fires on the 28th/29th).
 */
export function isReportDue(report: ReportRow, now: Date): boolean {
  if (!report.enabled) return false;
  if (!report.recipient_email) return false;

  const today = now.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(report.send_day, daysInMonth);
  if (today !== targetDay) return false;

  if (!report.last_sent_at) return true;
  return periodKey(report.cadence, new Date(report.last_sent_at)) !==
    periodKey(report.cadence, now);
}
