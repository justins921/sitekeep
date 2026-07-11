import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueReports } from "@/lib/report-runner";
import { runWeeklyRecaps } from "@/lib/keep-score/recap-runner";
import { reconcileTrials } from "@/lib/billing";

export const runtime = "nodejs";
// Belt-and-suspenders: never cache this route.
export const dynamic = "force-dynamic";
// Rendering + sending several reports can take a while.
export const maxDuration = 60;

/**
 * Daily cron (see vercel.json). Protected by CRON_SECRET so it cannot be
 * triggered anonymously — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Reads across agencies with the service-role client (allowed in cron only).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  // Flip first dashboards from free→paid at day 30 and keep quantities in step.
  const billing = await reconcileTrials(admin, now);
  const reports = await runDueReports(admin, now);
  // Per-account weekly Keep Score recap (fires on Mondays; no-ops otherwise).
  const recaps = await runWeeklyRecaps(admin, now);
  return NextResponse.json({ billing, reports, recaps });
}
