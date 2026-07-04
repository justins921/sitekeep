import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agency } from "@/lib/agency";
import type { SupabaseClient } from "@supabase/supabase-js";

// The "view as agency" support flow (Phase 14): a super-admin can set a cookie
// naming an agency to impersonate. The dashboard then renders that agency's data
// read-only. Reads are possible because super-admins have cross-tenant SELECT
// policies (migration 0010); writes are not (no write policy), so impersonation
// is structurally read-only even if a control leaked through.

export const VIEW_AS_COOKIE = "sk_view_as";

/** True when the signed-in user is on the super-admin allowlist. */
export async function isSuperAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("is_super_admin");
  return data === true;
}

export type ViewContext = {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  isSuperAdmin: boolean;
  /** Effective agency: the impersonated one when viewing-as, else the user's own. */
  agency: Agency;
  /** Impersonated agency name when viewing-as, else null. */
  viewingAs: string | null;
};

/**
 * Resolve the effective agency for a dashboard render. Redirects to /login when
 * unauthenticated. When a super-admin has a valid view-as cookie set, the
 * effective agency is that target (read-only); otherwise it's their own agency.
 */
export async function getViewContext(): Promise<ViewContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const superAdmin = await isSuperAdmin(supabase);

  let agency: Agency | null = null;
  let viewingAs: string | null = null;

  if (superAdmin) {
    const store = await cookies();
    const targetId = store.get(VIEW_AS_COOKIE)?.value;
    if (targetId) {
      const { data } = await supabase
        .from("agencies")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();
      if (data) {
        agency = data as Agency;
        viewingAs = (data as Agency).name;
      }
    }
  }

  if (!agency) {
    const { data } = await supabase
      .from("agencies")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    if (!data) redirect("/login");
    agency = data as Agency;
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? "",
    isSuperAdmin: superAdmin,
    agency,
    viewingAs,
  };
}
