import { notFound, redirect } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
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
  created_at: string;
};

export type ClientService = {
  id: string;
  client_id: string;
  service_type: ServiceType;
  enabled: boolean;
};

/** List every client owned by the signed-in agency (RLS-scoped). */
export async function listClients(): Promise<Client[]> {
  const supabase = await createSupabase();
  const { data } = await supabase
    .from("clients")
    .select("*")
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
