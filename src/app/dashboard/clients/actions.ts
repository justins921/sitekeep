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
  freeAllowance,
  getAgencyCreatedAt,
  getSubscription,
  isEntitled,
  paidSeatsFor,
  syncSubscriptionQuantity,
} from "@/lib/billing";
import { recordUptimeCheck, writeUptimeSnapshot } from "@/lib/uptime";
import { detectSignificantSwings } from "@/lib/auto-annotations";
import { resolveMembership } from "@/lib/agency";

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

  // Any member (owner or member) can manage clients — resolve via membership.
  const membership = await resolveMembership(supabase, user.id);
  if (!membership) redirect("/join");
  return { agencyId: membership.agency.id, email: user.email ?? undefined };
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

  // A new dashboard activates free only if it fits in the 30-day free allowance
  // (the first dashboard). Otherwise it's a paid seat — created paused, then
  // either confirmed (subscribers) or paid for via Checkout.
  const [activeCount, sub, createdAt] = await Promise.all([
    countActiveDashboards(supabase, agency_id),
    getSubscription(supabase, agency_id),
    getAgencyCreatedAt(supabase, agency_id),
  ]);
  const entitled = isEntitled(sub?.status);
  const canFree = activeCount < freeAllowance(createdAt);
  const is_active = canFree;

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
    redirect(`/dashboard/clients/${newId}`); // free dashboard, live now
  }

  // Paid seat needed. Subscribers confirm the extra $3/mo on the client page;
  // everyone else goes to Checkout (which activates the client on payment).
  if (entitled) {
    redirect(`/dashboard/clients/${newId}?confirm=1`);
  }
  const checkout = await createCheckoutUrl(supabase, agency_id, email, {
    quantity: paidSeatsFor(activeCount + 1, createdAt),
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

  // Gate: activating a paid seat requires a subscription (unless it fits in the
  // 30-day free allowance).
  if (is_active) {
    const [{ count: otherActive }, sub, createdAt] = await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("is_active", true)
        .neq("id", clientId),
      getSubscription(supabase, agencyId),
      getAgencyCreatedAt(supabase, agencyId),
    ]);
    const fitsFree = (otherActive ?? 0) + 1 <= freeAllowance(createdAt);
    if (!fitsFree && !isEntitled(sub?.status)) {
      return {
        error:
          "Activating this dashboard is $3/mo. Subscribe from the client page to turn it on.",
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
 * Confirm the extra $3/mo and activate a paused client for an already-subscribed
 * agency. Activating adds a paid seat (billed immediately via
 * syncSubscriptionQuantity).
 */
export async function confirmActivateAction(clientId: string): Promise<void> {
  const supabase = await createSupabase();
  const { agencyId } = await requireAgency(supabase);

  const { error } = await supabase
    .from("clients")
    .update({ is_active: true })
    .eq("id", clientId)
    .eq("agency_id", agencyId);
  if (!error) await syncSubscriptionQuantity(supabase, agencyId);

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
  const [activeCount, createdAt] = await Promise.all([
    countActiveDashboards(supabase, agencyId),
    getAgencyCreatedAt(supabase, agencyId),
  ]);
  const checkout = await createCheckoutUrl(supabase, agencyId, email, {
    quantity: paidSeatsFor(activeCount + 1, createdAt),
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
    .select("id, website_url, ga4_property_id, agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) redirect("/dashboard");

  const { data: enabledRows } = await supabase
    .from("client_services")
    .select("service_type, config")
    .eq("client_id", clientId)
    .eq("enabled", true);

  const enabled = (enabledRows ?? []).map((r) => r.service_type as ServiceType);
  if (enabled.length === 0) return { ran: false, results: [] };

  // GA4 property id: per-service config first, legacy client column as fallback.
  const trafficConfig = (enabledRows ?? []).find((r) => r.service_type === "traffic")
    ?.config as { ga4_property_id?: string | null } | null | undefined;
  const ga4PropertyId = trafficConfig?.ga4_property_id ?? client.ga4_property_id;

  // Search Console property (URL-prefix or sc-domain) from the service config.
  const gscConfig = (enabledRows ?? []).find((r) => r.service_type === "search_console")
    ?.config as { gsc_site_url?: string | null } | null | undefined;
  const gscSiteUrl = gscConfig?.gsc_site_url ?? null;

  const results = await Promise.all(
    enabled.map(async (service_type) => {
      try {
        // Uptime is stateful (logs a check + rolling snapshot); other services
        // are pure URL→result and share the insert path below.
        if (service_type === "uptime") {
          await recordUptimeCheck(supabase, clientId, client.website_url);
          await writeUptimeSnapshot(supabase, clientId, new Date());
          return { service_type, ok: true };
        }

        const result = await runService(service_type, client.website_url, {
          ga4PropertyId,
          gscSiteUrl,
        });
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

  // Auto-annotate any trend metric that swung >20% vs its previous snapshot.
  try {
    await detectSignificantSwings(supabase, clientId, client.agency_id, new Date());
  } catch {
    // best-effort — annotations are derived, never part of the refresh contract
  }

  // Composite health score: recompute from the just-written snapshots (the SQL
  // function is the single source of truth) and store it as a 'health_score'
  // snapshot. Best-effort — a scoring hiccup must never fail the refresh.
  try {
    const { data: health } = await supabase.rpc("compute_client_health", {
      p_client: clientId,
    });
    if (health) {
      await supabase
        .from("metric_snapshots")
        .insert({ client_id: clientId, service_type: "health_score", data: health });
    }
  } catch {
    // ignore — scoring is derived data, not part of the refresh contract
  }

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
