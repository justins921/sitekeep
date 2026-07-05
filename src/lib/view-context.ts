import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveMembership, type Agency, type AgencyRole } from "@/lib/agency";
import type { SupabaseClient } from "@supabase/supabase-js";

// The "view as agency" support flow (Phase 14): a super-admin can set a cookie
// naming an agency to impersonate. The dashboard then renders that agency's data
// read-only. Reads are possible because super-admins have cross-tenant SELECT
// policies (migration 0010); writes are not (no write policy), so impersonation
// is structurally read-only even if a control leaked through.

export const VIEW_AS_COOKIE = "sk_view_as";

/** Parsed SUPER_ADMIN_EMAILS allowlist (comma-separated, case-insensitive). */
export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when the signed-in user's email is on the SUPER_ADMIN_EMAILS allowlist.
 * This env allowlist is the app-side authority for /admin. The DB `super_admins`
 * table (migration 0010) backs the RLS `is_super_admin()` checks (cross-tenant
 * reads + feature-flag writes); keep the two allowlists in sync.
 */
export async function isSuperAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return Boolean(email && superAdminEmails().includes(email));
}

export type ViewContext = {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  isSuperAdmin: boolean;
  /** Effective agency: the impersonated one when viewing-as, else the user's own. */
  agency: Agency;
  /** The user's role in their OWN agency ('owner'|'member'); 'owner' while viewing-as. */
  role: AgencyRole;
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
  let role: AgencyRole = "owner";

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
        role = "owner"; // impersonation is read-only regardless of role
      }
    }
  }

  if (!agency) {
    const membership = await resolveMembership(supabase, user.id);
    if (!membership) redirect("/join");
    agency = membership.agency;
    role = membership.role;
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? "",
    isSuperAdmin: superAdmin,
    agency,
    role,
    viewingAs,
  };
}
