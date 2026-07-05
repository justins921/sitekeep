import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only feature-flag layer. Reads go through the request-scoped (RLS)
// client: an agency member can read their own agency's override (is_agency_member)
// and the global default (feature_flags is readable by any authenticated user).
// Writes are super-admin-only (RLS) and live in the /admin actions.

export type FeatureState = {
  enabled: boolean;
  variant: string;
  config: Record<string, unknown>;
};

export type FeatureFlag = {
  key: string;
  description: string | null;
  default_enabled: boolean;
  default_variant: string | null;
};

export type AgencyFlagOverride = {
  agency_id: string;
  flag_key: string;
  enabled: boolean | null;
  variant: string | null;
  config: Record<string, unknown> | null;
};

/**
 * Effective feature state for an agency: the per-agency override merged over the
 * global default. A null override field falls back to the default. Fails safe to
 * disabled/off when the flag is unknown. Server-side only.
 */
export async function getFeature(
  agencyId: string,
  key: string,
  client?: SupabaseClient,
): Promise<FeatureState> {
  const supabase = client ?? (await createClient());

  const [{ data: def }, { data: ov }] = await Promise.all([
    supabase
      .from("feature_flags")
      .select("default_enabled, default_variant")
      .eq("key", key)
      .maybeSingle(),
    supabase
      .from("agency_feature_flags")
      .select("enabled, variant, config")
      .eq("agency_id", agencyId)
      .eq("flag_key", key)
      .maybeSingle(),
  ]);

  const enabled = ov?.enabled ?? def?.default_enabled ?? false;
  const variant = ov?.variant ?? def?.default_variant ?? "off";
  const config = (ov?.config as Record<string, unknown> | null) ?? {};
  return { enabled, variant, config };
}

/** All global flags (for the /admin console). */
export async function listFeatureFlags(supabase: SupabaseClient): Promise<FeatureFlag[]> {
  const { data } = await supabase
    .from("feature_flags")
    .select("key, description, default_enabled, default_variant")
    .order("key");
  return (data as FeatureFlag[]) ?? [];
}

/** Every per-agency override, keyed `${agency_id}:${flag_key}` (for the console). */
export async function listAgencyFlagOverrides(
  supabase: SupabaseClient,
): Promise<Map<string, AgencyFlagOverride>> {
  const { data } = await supabase
    .from("agency_feature_flags")
    .select("agency_id, flag_key, enabled, variant, config");
  const map = new Map<string, AgencyFlagOverride>();
  for (const row of (data as AgencyFlagOverride[]) ?? []) {
    map.set(`${row.agency_id}:${row.flag_key}`, row);
  }
  return map;
}
