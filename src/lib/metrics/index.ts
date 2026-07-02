import { createClient } from "@/lib/supabase/server";
import type { ServiceType } from "@/lib/services";
import type { ServiceResult, Snapshot } from "./types";
import { runPageSpeed } from "./pagespeed";
import { runSecurity } from "./security";
import { runTraffic } from "./traffic";

export * from "./types";

/** Provider registry — one entry per service_type. */
const PROVIDERS: Record<
  ServiceType,
  (url: string) => Promise<ServiceResult<unknown>>
> = {
  page_speed: runPageSpeed,
  traffic: runTraffic,
  security: runSecurity,
};

export function runService(
  type: ServiceType,
  url: string,
): Promise<ServiceResult<unknown>> {
  return PROVIDERS[type](url);
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
