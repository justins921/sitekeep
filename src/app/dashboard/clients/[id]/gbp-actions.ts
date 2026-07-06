"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePlaceId } from "@/lib/metrics/google-business";

export type GbpSettingsResult = { error: string } | { ok: true; matched: string };

/**
 * Resolve a typed business name to a Google Place ID (Find Place From Text) and
 * persist it in client_services.config.place_id for the google_business service.
 * Blank clears the mapping. RLS-scoped. Merges into existing config.
 */
export async function setGooglePlaceAction(
  clientId: string,
  query: string,
): Promise<GbpSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = query.trim();

  const { data: existing } = await supabase
    .from("client_services")
    .select("enabled, config")
    .eq("client_id", clientId)
    .eq("service_type", "google_business")
    .maybeSingle();
  const prevConfig = (existing?.config as Record<string, unknown> | null) ?? {};

  let place_id: string | null = null;
  let place_name = "";
  if (trimmed) {
    // Accept a raw Place ID (starts with "ChI") directly; otherwise resolve it.
    if (/^ChI[\w-]+$/.test(trimmed)) {
      place_id = trimmed;
      place_name = trimmed;
    } else {
      const resolved = await resolvePlaceId(trimmed);
      if (!resolved) {
        return {
          error:
            "Couldn’t find that business on Google. Try the full name plus city, or paste the Place ID. (A Places API key must be configured.)",
        };
      }
      place_id = resolved.place_id;
      place_name = resolved.name || resolved.address || resolved.place_id;
    }
  }

  const config = { ...prevConfig, place_id, place_name: place_id ? place_name : null };

  const { error } = await supabase.from("client_services").upsert(
    {
      client_id: clientId,
      service_type: "google_business",
      enabled: existing?.enabled ?? true,
      config,
    },
    { onConflict: "client_id,service_type" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath(`/dashboard/clients/${clientId}/settings`);
  return { ok: true, matched: place_id ? place_name : "Cleared" };
}
