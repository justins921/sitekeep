import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Agency = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  alert_email: string | null;
  created_at: string;
};

export type AgencyRole = "owner" | "member";

/**
 * Resolve the agency the signed-in user belongs to, via agency_members (team
 * seats). A user with several memberships resolves to their owner agency first,
 * else the earliest. Returns null when the user belongs to no agency yet (e.g.
 * an invited user who hasn't accepted).
 */
export async function resolveMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ agency: Agency; role: AgencyRole } | null> {
  const { data } = await supabase
    .from("agency_members")
    .select("role, created_at, agencies(*)")
    .eq("user_id", userId);

  const rows = (data ?? [])
    .map((r) => {
      const rel = (r as { agencies?: Agency | Agency[] }).agencies;
      const agency = Array.isArray(rel) ? rel[0] : rel;
      return { role: r.role as AgencyRole, created_at: r.created_at as string, agency };
    })
    .filter((r): r is { role: AgencyRole; created_at: string; agency: Agency } => Boolean(r.agency));

  if (rows.length === 0) return null;
  rows.sort(
    (a, b) =>
      (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1) ||
      a.created_at.localeCompare(b.created_at),
  );
  return { agency: rows[0].agency, role: rows[0].role };
}

/**
 * Returns the signed-in user's agency + their role, redirecting to /login if
 * there is no session and to /join if they're authenticated but not yet a member
 * of any agency (an invited user who hasn't accepted).
 */
export async function requireAgency(): Promise<{
  agency: Agency;
  userEmail: string;
  role: AgencyRole;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await resolveMembership(supabase, user.id);
  if (!membership) redirect("/join");

  return { agency: membership.agency, userEmail: user.email ?? "", role: membership.role };
}
