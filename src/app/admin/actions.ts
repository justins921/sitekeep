"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, VIEW_AS_COOKIE } from "@/lib/view-context";
import { variantsFor } from "@/lib/features-meta";

// "View as agency" support flow. Only a super-admin can set the impersonation
// cookie, and only for an agency that actually exists (verified through the
// super-admin SELECT policy). The cookie is httpOnly so it can't be forged from
// client JS; the dashboard reads it server-side via getViewContext().

export async function viewAsAgencyAction(agencyId: string): Promise<void> {
  const supabase = await createClient();
  if (!(await isSuperAdmin(supabase))) redirect("/dashboard");

  const { data } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .maybeSingle();
  if (!data) redirect("/admin/agencies");

  const store = await cookies();
  store.set(VIEW_AS_COOKIE, agencyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4, // 4h — a support session, not a standing grant
  });
  redirect("/dashboard");
}

export async function exitViewAsAction(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
  redirect("/admin/agencies");
}

// ------------------------------------------------------------- feature flags
export type SetFlagResult = { ok: boolean; error?: string };

/**
 * Upsert a per-agency feature-flag override. Authorization is enforced twice:
 * server-side here (isSuperAdmin, env allowlist) AND by RLS on the write
 * (agency_feature_flags_write → is_super_admin()). Setting a variant also flips
 * `enabled` to match (off → disabled, any real variant → enabled) so the two
 * can't drift.
 */
export async function setAgencyFlagAction(
  agencyId: string,
  flagKey: string,
  variant: string,
): Promise<SetFlagResult> {
  const supabase = await createClient();
  if (!(await isSuperAdmin(supabase))) return { ok: false, error: "Not authorized." };

  const allowed = variantsFor(flagKey);
  if (!allowed.includes(variant)) return { ok: false, error: "Unknown variant." };

  const enabled = variant !== "off";
  const { error } = await supabase.from("agency_feature_flags").upsert(
    {
      agency_id: agencyId,
      flag_key: flagKey,
      enabled,
      variant,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agency_id,flag_key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/flags");
  return { ok: true };
}
