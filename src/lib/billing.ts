import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, getPriceId } from "./stripe";

/**
 * Each agency's FIRST dashboard is free for its first 30 days (tracked here in
 * the app, NOT as a Stripe trial). After that it becomes a paid seat like any
 * other. Every dashboard beyond the free one is a paid $3/mo seat billed
 * immediately — so Stripe only ever sees "paid seats", charged right away.
 */
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

/** Statuses that mean the agency currently has a paid subscription. */
export function isEntitled(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** 1 free dashboard while inside the 30-day window, otherwise 0. */
export function freeAllowance(
  agencyCreatedAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!agencyCreatedAt) return 0;
  const end = new Date(agencyCreatedAt).getTime() + TRIAL_DAYS * 86_400_000;
  return now.getTime() < end ? 1 : 0;
}

/** How many dashboards must be paid for = active minus the free allowance. */
export function paidSeatsFor(
  activeCount: number,
  agencyCreatedAt: string | null | undefined,
  now?: Date,
): number {
  return Math.max(0, activeCount - freeAllowance(agencyCreatedAt, now));
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

export async function getAgencyCreatedAt(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("agencies")
    .select("created_at")
    .eq("id", agencyId)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
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

/**
 * Reconcile the Stripe subscription quantity with the number of PAID seats
 * (active dashboards minus the free one). Adds/removes bill immediately; if the
 * agency has no paid seats left, the subscription is cancelled. No-op without a
 * subscription. Stripe API only — safe to call from a user action.
 */
export async function syncSubscriptionQuantity(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const sub = await getSubscription(supabase, agencyId);
  if (!sub?.stripe_subscription_id) return;

  const [createdAt, activeCount] = await Promise.all([
    getAgencyCreatedAt(supabase, agencyId),
    countActiveDashboards(supabase, agencyId),
  ]);
  const seats = paidSeatsFor(activeCount, createdAt);
  const stripe = getStripe();

  if (seats <= 0) {
    if (isEntitled(sub.status)) {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    }
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item || item.quantity === seats) return;

  await stripe.subscriptions.update(sub.stripe_subscription_id, {
    items: [{ id: item.id, quantity: seats }],
    // Bill the change immediately (each added dashboard is charged right away).
    proration_behavior: "always_invoice",
  });
}

/**
 * Checkout for `quantity` PAID seats, charged immediately (no Stripe trial —
 * the free month is handled app-side). When `pendingClientId` is set, the
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

/**
 * Daily reconciliation (cron): keep subscription quantities in step (this is
 * what flips an agency's first dashboard from free to paid once its 30-day
 * window ends), and pause dashboards for agencies that are past the free
 * window with no subscription. Uses a service-role client.
 */
export async function reconcileTrials(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ synced: number; paused: number }> {
  let synced = 0;
  let paused = 0;

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("agency_id, status, stripe_subscription_id")
    .in("status", ["active", "trialing"]);
  for (const s of subs ?? []) {
    if (s.stripe_subscription_id) {
      await syncSubscriptionQuantity(supabase, s.agency_id as string);
      synced++;
    }
  }

  const { data: agencies } = await supabase.from("agencies").select("id, created_at");
  for (const a of agencies ?? []) {
    if (freeAllowance(a.created_at as string, now) > 0) continue; // still free
    const sub = await getSubscription(supabase, a.id as string);
    if (isEntitled(sub?.status)) continue; // covered by a subscription
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", a.id)
      .eq("is_active", true);
    if ((count ?? 0) > 0) {
      await supabase
        .from("clients")
        .update({ is_active: false })
        .eq("agency_id", a.id)
        .eq("is_active", true);
      paused += count ?? 0;
    }
  }

  return { synced, paused };
}
