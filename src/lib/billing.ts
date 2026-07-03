import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./stripe";

export type SubscriptionRow = {
  agency_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  quantity: number;
  current_period_end: string | null;
};

/** Statuses that entitle an agency to activate more than the free dashboard. */
export function isEntitled(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export async function getSubscription(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "agency_id, stripe_customer_id, stripe_subscription_id, status, quantity, current_period_end",
    )
    .eq("agency_id", agencyId)
    .maybeSingle();
  return (data as SubscriptionRow) ?? null;
}

export async function countActiveDashboards(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<number> {
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("is_active", true);
  return count ?? 0;
}

/** Free tier allows exactly one active dashboard. */
export const FREE_ACTIVE_LIMIT = 1;

/**
 * Whether the agency may have `desiredActiveCount` active dashboards: always if
 * within the free limit, otherwise only with an entitling subscription.
 */
export function withinPlan(
  desiredActiveCount: number,
  status: string | null | undefined,
): boolean {
  return desiredActiveCount <= FREE_ACTIVE_LIMIT || isEntitled(status);
}

/**
 * Keep the Stripe subscription quantity in step with the number of active
 * dashboards. No-op when the agency has no entitling subscription. Runs in a
 * user-facing server action (Stripe API call only — no service-role DB write).
 */
export async function syncSubscriptionQuantity(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const sub = await getSubscription(supabase, agencyId);
  if (!sub || !isEntitled(sub.status) || !sub.stripe_subscription_id) return;

  const activeCount = await countActiveDashboards(supabase, agencyId);
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) return;
  if (item.quantity === activeCount) return;

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, quantity: Math.max(activeCount, 1) }],
    proration_behavior: "create_prorations",
  });
}
