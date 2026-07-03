import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, getPriceId } from "./stripe";

/** First paid month is free, matching the landing page's "1 month free trial". */
export const TRIAL_DAYS = 30;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

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
    // Full price per dashboard — no prorated partial charges.
    proration_behavior: "none",
  });
}

/**
 * Create a Stripe Checkout session for a subscription covering `quantity`
 * dashboards, with a 30-day free trial. When `pendingClientId` is set, the
 * webhook activates that client on payment and Checkout returns to it.
 */
export async function createCheckoutUrl(
  supabase: SupabaseClient,
  agencyId: string,
  email: string | undefined,
  opts: { quantity: number; pendingClientId?: string },
): Promise<{ url: string } | { error: string }> {
  const priceId = getPriceId();
  if (!priceId) {
    return { error: "Billing isn't configured yet. Add a price ID to continue." };
  }

  const sub = await getSubscription(supabase, agencyId);
  const stripe = getStripe();

  const successPath = opts.pendingClientId
    ? `/dashboard/clients/${opts.pendingClientId}?subscribed=1`
    : `/dashboard/billing?checkout=success`;
  const cancelPath = opts.pendingClientId
    ? `/dashboard/clients/${opts.pendingClientId}?checkout=cancel`
    : `/dashboard/billing?checkout=cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: Math.max(opts.quantity, 1) }],
      client_reference_id: agencyId,
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: email }),
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          agency_id: agencyId,
          ...(opts.pendingClientId
            ? { pending_client_id: opts.pendingClientId }
            : {}),
        },
      },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}${successPath}`,
      cancel_url: `${siteUrl()}${cancelPath}`,
    });
    if (!session.url) return { error: "Could not start checkout." };
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Checkout failed." };
  }
}
