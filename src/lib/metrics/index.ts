import { createClient } from "@/lib/supabase/server";
import type { ServiceType } from "@/lib/services";
import type { ServiceResult, Snapshot } from "./types";
import { runPageSpeed } from "./pagespeed";
import { runSecurity } from "./security";
import { runTraffic } from "./traffic";

export * from "./types";

/** Extra per-run inputs a provider may need beyond the URL. */
export type RunOptions = { ga4PropertyId?: string | null };

/** Provider registry — one entry per service_type.
 * `uptime` is driven by src/lib/uptime.ts (it needs DB access to log checks and
 * manage incidents), so it's handled outside this URL→result path. */
const PROVIDERS: Record<
  ServiceType,
  (url: string, opts: RunOptions) => Promise<ServiceResult<unknown>>
> = {
  page_speed: (url) => runPageSpeed(url),
  traffic: (url, opts) => runTraffic(url, opts.ga4PropertyId),
  security: (url) => runSecurity(url),
  uptime: async () => ({ ok: false, error: "uptime is handled by the uptime monitor" }),
};

export function runService(
  type: ServiceType,
  url: string,
  opts: RunOptions = {},
): Promise<ServiceResult<unknown>> {
  return PROVIDERS[type](url, opts);
}

/**
 * Latest snapshot per service_type for a client (RLS-scoped). Returns a map
 * keyed by service_type. Used by the authed detail page; the public dashboard
 * reads the same "latest per service" via the get_public_dashboard RPC.
 */
export async function getLatestSnapshots(
  clientId: string,
): Promise<Partial<Record<ServiceType, Snapshot>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("metric_snapshots")
    .select("service_type, data, captured_at")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false });

  const out: Partial<Record<ServiceType, Snapshot>> = {};
  for (const row of data ?? []) {
    const type = row.service_type as ServiceType;
    if (!out[type]) {
      out[type] = {
        service_type: type,
        data: row.data,
        captured_at: row.captured_at,
      } as Snapshot;
    }
  }
  return out;
}
