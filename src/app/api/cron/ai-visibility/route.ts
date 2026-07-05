import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listStandaloneTargets,
  hasRecentSnapshot,
  generateForClient,
} from "@/lib/ai-visibility/standalone-generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One grounded LLM call per tracked prompt across several clients — give it room.
export const maxDuration = 300;

/**
 * Monthly standalone AI-visibility run (external cron-job.org, NOT Vercel Cron).
 * Protected by CRON_SECRET. Runs ONLY for enabled + subscribed 'standalone'
 * clients, respects each agency's cadence (skips clients with a fresh snapshot),
 * and logs per-run cost on each stored snapshot. Manual dashboard refresh never
 * reaches this path, so it can't be used to rack up LLM spend.
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
  const targets = await listStandaloneTargets(admin);

  const ran: unknown[] = [];
  let skipped = 0;
  let totalCost = 0;

  for (const t of targets) {
    if (await hasRecentSnapshot(admin, t.client.id, t.cadenceDays, now)) {
      skipped++;
      continue;
    }
    const result = await generateForClient(admin, t.client, t.config);
    totalCost += result.costUsd;
    ran.push(result);
  }

  return NextResponse.json({
    eligible: targets.length,
    ran: ran.length,
    skipped,
    total_cost_usd: Math.round(totalCost * 10000) / 10000,
    results: ran,
  });
}
