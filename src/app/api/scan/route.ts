import { NextResponse, type NextRequest } from "next/server";
import { normalizeUrl } from "@/lib/utils";
import { runScan } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PageSpeed can take ~30s — give the scan room.
export const maxDuration = 60;

// Anonymous scan endpoint for scan-first onboarding. No auth, no DB writes.
// Rate-limited per IP (best-effort, in-memory) so it can't be used to hammer
// arbitrary sites through our servers. A single instance resets on redeploy —
// that's acceptable for an abuse speed-bump, not a billing control.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "You've run a lot of scans — give it a few minutes and try again." },
      { status: 429 },
    );
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? normalizeUrl(body.url) : null;
  if (!url) {
    return NextResponse.json(
      { error: "Enter a valid website address (e.g. example.com)." },
      { status: 400 },
    );
  }

  try {
    const result = await runScan(url);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "We couldn't finish scanning that site. Check the address and try again." },
      { status: 502 },
    );
  }
}
