import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSslExpiryChecks, runUptimeMonitoring } from "@/lib/uptime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Uptime + SSL monitoring cron. Triggered by an EXTERNAL scheduler (cron-job.org)
 * — NOT Vercel Cron — which sends `Authorization: Bearer <CRON_SECRET>`.
 * Idempotent and safe to call at its cadence: the incident state machine only
 * alerts on down↔up edges. Reads across agencies via the service-role client.
 *
 *   GET /api/cron/uptime            → run the uptime sweep (every ~5 min)
 *   GET /api/cron/uptime?ssl=1      → also run the daily SSL-expiry sweep
 *   GET /api/cron/uptime?ssl_days=N → force days-to-expiry (test only; the
 *                                     sandbox MITMs TLS so real reads are bogus)
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

  const uptime = await runUptimeMonitoring(admin, now);

  const forced = req.nextUrl.searchParams.get("ssl_days");
  const runSsl = req.nextUrl.searchParams.get("ssl") === "1" || forced !== null;
  const ssl = runSsl
    ? await runSslExpiryChecks(
        admin,
        now,
        forced !== null ? { forceDaysToExpiry: Number(forced) } : {},
      )
    : null;

  return NextResponse.json({ uptime, ssl });
}
