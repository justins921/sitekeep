"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeGscSiteUrl } from "@/lib/metrics/gsc";

export type GscSettingsResult = { error: string } | { ok: true };

/**
 * Persist the client's Search Console property in client_services.config for the
 * search_console service (RLS-scoped). Accepts URL-prefix or sc-domain formats.
 * Empty clears it (back to the not-connected state). Merges into existing config.
 */
export async function setGscSiteAction(
  clientId: string,
  rawSiteUrl: string,
): Promise<GscSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = rawSiteUrl.trim();
  if (trimmed && !normalizeGscSiteUrl(trimmed)) {
    return {
      error:
        "Enter a URL-prefix property (https://www.example.com/) or a domain property (sc-domain:example.com).",
    };
  }
  const site = normalizeGscSiteUrl(trimmed);

  const { data: existing } = await supabase
    .from("client_services")
    .select("enabled, config")
    .eq("client_id", clientId)
    .eq("service_type", "search_console")
    .maybeSingle();

  const config = {
    ...((existing?.config as Record<string, unknown> | null) ?? {}),
    gsc_site_url: site,
  };

  const { error } = await supabase.from("client_services").upsert(
    {
      client_id: clientId,
      service_type: "search_console",
      enabled: existing?.enabled ?? true,
      config,
    },
    { onConflict: "client_id,service_type" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ok: true };
}
