import { notFound, redirect } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { getViewContext } from "@/lib/view-context";
import { type ServiceType } from "@/lib/services";

export { SERVICE_TYPES, SERVICE_META, type ServiceType } from "@/lib/services";

export type Client = {
  id: string;
  agency_id: string;
  company_name: string;
  website_url: string;
  contact_email: string | null;
  monthly_rate: number;
  logo_url: string | null;
  slug: string;
  is_active: boolean;
  ga4_property_id: string | null;
  created_at: string;
};

export type ClientService = {
  id: string;
  client_id: string;
  service_type: ServiceType;
  enabled: boolean;
};

/**
 * List clients for the effective agency (the signed-in agency, or the one a
 * super-admin is viewing-as). Filters by agency_id explicitly: super-admins have
 * cross-tenant read policies, so relying on RLS alone would leak every agency's
 * clients into their own list.
 */
export async function listClients(): Promise<Client[]> {
  const { supabase, agency } = await getViewContext();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as Client[];
}

/**
 * Load one client the signed-in user owns, plus its enabled/disabled services.
 * RLS guarantees a client from another agency is invisible → notFound().
 */
export async function getClientWithServices(id: string): Promise<{
  client: Client;
  services: Record<ServiceType, boolean>;
}> {
  const supabase = await createSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const { data: rows } = await supabase
    .from("client_services")
    .select("service_type, enabled")
    .eq("client_id", id);

  const services = { page_speed: false, traffic: false, security: false } as Record<
    ServiceType,
    boolean
  >;
  for (const row of rows ?? []) {
    services[row.service_type as ServiceType] = row.enabled;
  }

  return { client: client as Client, services };
}
