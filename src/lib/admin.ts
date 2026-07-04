import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/view-context";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceType } from "@/lib/services";

// Server-only data layer for the /admin dashboard. Everything goes through the
// request-scoped (RLS) client — never the service role — per CLAUDE.md. The
// cross-tenant reads are authorised by the super-admin SELECT policies and the
// two security-definer aggregate functions from migration 0010.

export type AdminOverview = {
  mrr: number;
  total_agencies: number;
  active_dashboards: number;
  trial_agencies: number;
  failed_payments: number;
  conversion_rate: number;
};

export type AdminClient = {
  id: string;
  company_name: string;
  website_url: string;
  slug: string;
  is_active: boolean;
  services: ServiceType[];
  last_refresh: string | null;
  health: number | null;
};

export type AdminAgency = {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  status: string;
  quantity: number;
  mrr: number;
  client_count: number;
  active_client_count: number;
  last_active: string | null;
  clients: AdminClient[];
};

export type SubscriptionEvent = {
  status: string;
  quantity: number;
  updated_at: string;
  agency_name: string | null;
};

/**
 * Guard for every /admin surface. Returns the RLS client + user when the caller
 * is a super-admin; otherwise redirects to /dashboard WITHOUT revealing that the
 * route exists (no error, no 403).
 */
export async function requireSuperAdmin(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isSuperAdmin(supabase))) redirect("/dashboard");
  return { supabase, userId: user.id };
}

export async function getAdminOverview(
  supabase: SupabaseClient,
): Promise<AdminOverview | null> {
  const { data } = await supabase.rpc("admin_overview");
  return (data as AdminOverview) ?? null;
}

export async function listAdminAgencies(
  supabase: SupabaseClient,
): Promise<AdminAgency[]> {
  const { data } = await supabase.rpc("admin_list_agencies");
  return (data as AdminAgency[]) ?? [];
}

/** Last N subscription changes across the platform, newest first. */
export async function recentSubscriptionEvents(
  supabase: SupabaseClient,
  limit = 10,
): Promise<SubscriptionEvent[]> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, quantity, updated_at, agencies(name)")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => {
    const rel = (r as { agencies?: { name?: string } | { name?: string }[] }).agencies;
    const agency_name = Array.isArray(rel) ? rel[0]?.name ?? null : rel?.name ?? null;
    return {
      status: r.status as string,
      quantity: r.quantity as number,
      updated_at: r.updated_at as string,
      agency_name,
    };
  });
}
