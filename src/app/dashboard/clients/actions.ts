"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { normalizeUrl, slugify } from "@/lib/utils";
import { SERVICE_TYPES, type ServiceType } from "@/lib/services";
import { runService } from "@/lib/metrics";
import {
  countActiveDashboards,
  createCheckoutUrl,
  FREE_ACTIVE_LIMIT,
  getSubscription,
  isEntitled,
  syncSubscriptionQuantity,
  withinPlan,
} from "@/lib/billing";

export type ClientFormState = { error: string } | null;

type ClientValues = {
  company_name: string;
  website_url: string;
  contact_email: string | null;
  monthly_rate: number;
};
type ParseResult = { error: string } | { values: ClientValues };

function parseForm(formData: FormData): ParseResult {
  const company_name = String(formData.get("company_name") ?? "").trim();
  const rawUrl = String(formData.get("website_url") ?? "");
  const contact_email = String(formData.get("contact_email") ?? "").trim();
  const rawRate = String(formData.get("monthly_rate") ?? "").trim();

  if (!company_name) return { error: "Company name is required." as const };

  const website_url = normalizeUrl(rawUrl);
  if (!website_url) {
    return { error: "Enter a valid website URL (e.g. example.com)." as const };
  }

  const monthly_rate = rawRate === "" ? 0 : Number(rawRate);
  if (!Number.isFinite(monthly_rate) || monthly_rate < 0) {
    return { error: "Monthly rate must be a positive number." as const };
  }

  return {
    values: {
      company_name,
      website_url,
      contact_email: contact_email || null,
      monthly_rate,
    },
  };
}

async function requireAgency(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
): Promise<{ agencyId: string; email: string | undefined }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!agency) redirect("/login");
  return { agencyId: agency.id as string, email: user.email ?? undefined };
}

const randomSuffix = () => Math.random().toString(36).slice(2, 7);

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createSupabase();
  const { agencyId: agency_id, email } = await requireAgency(supabase);

  // Activation rules:
  //  - subscribers can always activate (they pay per active dashboard);
  //  - everyone else gets the first dashboard free;
  //  - anything beyond that must be paid → we route to Checkout below.
  const [activeCount, sub] = await Promise.all([
    countActiveDashboards(supabase, agency_id),
    getSubscription(supabase, agency_id),
  ]);
  const entitled = isEntitled(sub?.status);
  const is_active = entitled || activeCount < FREE_ACTIVE_LIMIT;

  const base = slugify(parsed.values.company_name) || "client";
  let newId: string | null = null;

  // Slug is globally unique. Try the clean slug first, then fall back to a
  // random suffix on collision (Postgres unique_violation = 23505).
  for (let attempt = 0; attempt < 6 && !newId; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...parsed.values, agency_id, slug, is_active })
      .select("id")
      .single();

    if (!error && data) {
      newId = data.id as string;
      break;
    }
    if (error && error.code !== "23505") {
      return { error: error.message };
    }
  }

  if (!newId) return { error: "Could not generate a unique link. Try again." };

  revalidatePath("/dashboard");

  if (is_active) {
    // Subscriber added a dashboard → add a full-price seat + activate now.
    if (entitled) await syncSubscriptionQuantity(supabase, agency_id);
    redirect(`/dashboard/clients/${newId}`);
  }

  // Needs payment → send them straight to Checkout; the webhook activates this
  // client once payment succeeds. Fall back to a paused state + upgrade prompt
  // if billing isn't configured.
  const checkout = await createCheckoutUrl(supabase, agency_id, email, {
    quantity: activeCount + 1,
    pendingClientId: newId,
  });
  if ("url" in checkout) redirect(checkout.url);
  redirect(`/dashboard/clients/${newId}?gated=1`);
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = parseForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const is_active = formData.get("is_active") === "on";

  const supabase = await createSupabase();
  const { agencyId } = await requireAgency(supabase);

  // Free-tier gate: block activating beyond the free limit without a subscription.
  if (is_active) {
    const { count: otherActive } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("is_active", true)
      .neq("id", clientId);
    const sub = await getSubscription(supabase, agencyId);
    if (!withinPlan((otherActive ?? 0) + 1, sub?.status)) {
      return {
        error:
          "You're on the free tier (1 active dashboard). Subscribe in Billing to activate more.",
      };
    }
  }

  // RLS scopes the update to the owning agency; a non-owned id updates 0 rows.
  const { error } = await supabase
    .from("clients")
    .update({ ...parsed.values, is_active })
    .eq("id", clientId);

  if (error) return { error: error.message };

  await syncSubscriptionQuantity(supabase, agencyId);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
  redirect(`/dashboard/clients/${clientId}`);
}

/**
 * Start Checkout to activate a specific paused client (used by the "paused"
 * recovery prompt when a prior Checkout was cancelled). The webhook activates
 * the client on success.
 */
export async function startClientCheckoutAction(clientId: string): Promise<void> {
  const supabase = await createSupabase();
  const { agencyId, email } = await requireAgency(supabase);
  const activeCount = await countActiveDashboards(supabase, agencyId);
  const checkout = await createCheckoutUrl(supabase, agencyId, email, {
    quantity: activeCount + 1,
    pendingClientId: clientId,
  });
  if ("url" in checkout) redirect(checkout.url);
  redirect(`/dashboard/clients/${clientId}?gated=1`);
}

export async function deleteClientAction(clientId: string): Promise<void> {
  const supabase = await createSupabase();
  const { agencyId } = await requireAgency(supabase);
  // RLS ensures only the owner can delete; cascades remove services/metrics.
  await supabase.from("clients").delete().eq("id", clientId);
  // Active-dashboard count may have dropped — keep Stripe quantity in step.
  await syncSubscriptionQuantity(supabase, agencyId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export type RefreshResult = {
  ran: boolean;
  results: Array<{ service_type: ServiceType; ok: boolean; error?: string }>;
};

/**
 * Re-run only the ENABLED services for a client, writing a fresh
 * metric_snapshots row per successful service. Services run in parallel and
 * are isolated: one provider failing (bad URL, timeout, API error) never
 * blocks the others, and a failure leaves the prior snapshot intact.
 */
export async function refreshMetricsAction(
  clientId: string,
): Promise<RefreshResult> {
  const supabase = await createSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS scopes this to the owner; a non-owned id returns null.
  const { data: client } = await supabase
    .from("clients")
    .select("id, website_url")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) redirect("/dashboard");

  const { data: enabledRows } = await supabase
    .from("client_services")
    .select("service_type")
    .eq("client_id", clientId)
    .eq("enabled", true);

  const enabled = (enabledRows ?? []).map((r) => r.service_type as ServiceType);
  if (enabled.length === 0) return { ran: false, results: [] };

  const results = await Promise.all(
    enabled.map(async (service_type) => {
      try {
        const result = await runService(service_type, client.website_url);
        if (!result.ok) return { service_type, ok: false, error: result.error };

        const { error } = await supabase.from("metric_snapshots").insert({
          client_id: clientId,
          service_type,
          data: result.data,
        });
        if (error) return { service_type, ok: false, error: error.message };
        return { service_type, ok: true };
      } catch (err) {
        return {
          service_type,
          ok: false,
          error: err instanceof Error ? err.message : "Unexpected error.",
        };
      }
    }),
  );

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { ran: true, results };
}

export async function setServiceEnabledAction(
  clientId: string,
  serviceType: ServiceType,
  enabled: boolean,
): Promise<{ error: string } | null> {
  if (!SERVICE_TYPES.includes(serviceType)) return { error: "Unknown service." };

  const supabase = await createSupabase();
  // owns_client() RLS gates this; upsert on the (client_id, service_type) unique key.
  const { error } = await supabase
    .from("client_services")
    .upsert(
      { client_id: clientId, service_type: serviceType, enabled },
      { onConflict: "client_id,service_type" },
    );

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/clients/${clientId}`);
  return null;
}
