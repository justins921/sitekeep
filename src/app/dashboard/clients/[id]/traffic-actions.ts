"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeGa4PropertyId } from "@/lib/metrics/ga4";

export type TrafficSettingsResult = { error: string } | { ok: true };

/**
 * Persist the client's GA4 property id in client_services.config for the traffic
 * service (RLS-scoped). Empty clears it (back to demo). Merges into any existing
 * config so we don't clobber other keys.
 */
export async function setGa4PropertyAction(
  clientId: string,
  rawPropertyId: string,
): Promise<TrafficSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = rawPropertyId.trim();
  if (trimmed && !normalizeGa4PropertyId(trimmed)) {
    return {
      error: "GA4 Property ID must be numeric (e.g. 123456789), not a G-XXXX measurement ID.",
    };
  }
  const property = normalizeGa4PropertyId(trimmed);

  const { data: existing } = await supabase
    .from("client_services")
    .select("enabled, config")
    .eq("client_id", clientId)
    .eq("service_type", "traffic")
    .maybeSingle();

  const config = {
    ...((existing?.config as Record<string, unknown> | null) ?? {}),
    ga4_property_id: property,
  };

  const { error } = await supabase
    .from("client_services")
    .upsert(
      {
        client_id: clientId,
        service_type: "traffic",
        enabled: existing?.enabled ?? true,
        config,
      },
      { onConflict: "client_id,service_type" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}
