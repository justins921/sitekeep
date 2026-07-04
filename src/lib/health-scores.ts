import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Reads the stored composite health scores (written on refresh as 'health_score'
// snapshots). The scoring model itself lives in the SQL compute_client_health()
// function — this module just fetches the latest stored result for display on
// the agency dashboard client list and the client-detail breakdown card.

export type HealthServiceBreakdown = {
  scored: boolean;
  value?: number | string;
  fraction?: number;
};

export type HealthSnapshot = {
  score: number | null;
  scored_count: number;
  enabled_count: number;
  services: Partial<Record<string, HealthServiceBreakdown>>;
  captured_at?: string;
};

/** Latest stored health snapshot per client id (RLS-scoped). */
export async function getLatestHealth(
  supabase: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, HealthSnapshot>> {
  const out = new Map<string, HealthSnapshot>();
  if (clientIds.length === 0) return out;

  const { data } = await supabase
    .from("metric_snapshots")
    .select("client_id, data, captured_at")
    .eq("service_type", "health_score")
    .in("client_id", clientIds)
    .order("captured_at", { ascending: false });

  for (const row of data ?? []) {
    const id = row.client_id as string;
    if (!out.has(id)) {
      out.set(id, { ...(row.data as HealthSnapshot), captured_at: row.captured_at as string });
    }
  }
  return out;
}

/** Convenience for a single client. */
export async function getClientHealth(
  supabase: SupabaseClient,
  clientId: string,
): Promise<HealthSnapshot | null> {
  const map = await getLatestHealth(supabase, [clientId]);
  return map.get(clientId) ?? null;
}
