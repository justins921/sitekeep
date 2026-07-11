import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe, getPriceId } from "./stripe";
import {
  PLANS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAY,
  siteCap,
  smallestPlanFor,
  type BillingInterval,
  type PlanTier,
} from "./plans";
import { renderTrialReminderEmail } from "./billing-email";
import { sendEmail } from "./email";

/**
 * Billing model v2: two flat plans (Solo ≤3 sites, Agency ≤15 + white-label),
 * each with a card-required 14-day Stripe trial. There is no per-seat charge and
 * no permanent free tier — a brand-new agency gets a short app-side grace to
 * start its trial, after which unmonitored dashboards pause until a plan is live.
 */

// App-side grace (days) for a just-signed-up agency to start its trial before
// its imported preview site pauses. Matches the trial length in spirit.
const START_GRACE_DAYS = TRIAL_DAYS;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export type SubscriptionRow = {
  agency_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: PlanTier | null;
  billing_interval: BillingInterval | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
};

/** Statuses that mean the agency currently has access (paid or in trial). */
export function isEntitled(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** How many active sites this agency may run right now (0 when not entitled). */
export function currentSiteCap(sub: SubscriptionRow | null): number {
  return sub && isEntitled(sub.status) ? siteCap(sub.plan) : 0;
}

/** Can the agency turn on one more site? */
export function canAddSite(sub: SubscriptionRow | null, activeCount: number): boolean {
  return isEntitled(sub?.status) && activeCount < currentSiteCap(sub);
}

export async function getSubscription(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "agency_id, stripe_customer_id, stripe_subscription_id, status, plan, billing_interval, trial_end, cancel_at_period_end, current_period_end",
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
 * Start a card-required 14-day trial on a plan + interval via Stripe Checkout.
 * When `pendingClientId` is set, the webhook activates that client once the
 * trial starts, and Checkout returns to it. No charge until the trial ends.
 */
export async function startTrialCheckout(
  supabase: SupabaseClient,
  agencyId: string,
  email: string | undefined,
  opts: { plan: PlanTier; interval: BillingInterval; pendingClientId?: string },
): Promise<{ url: string } | { error: string }> {
  const priceId = getPriceId(opts.plan, opts.interval);
  if (!priceId) {
    return { error: "That plan isn't configured yet. Add its Stripe price id to continue." };
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
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: agencyId,
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: email }),
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          agency_id: agencyId,
          plan: opts.plan,
          billing_interval: opts.interval,
          ...(opts.pendingClientId ? { pending_client_id: opts.pendingClientId } : {}),
        },
      },
      // Card required up front even though the trial doesn't charge yet.
      payment_method_collection: "always",
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

/** Switch an active subscription to a different plan (upgrade/downgrade). */
export async function changePlan(
  supabase: SupabaseClient,
  agencyId: string,
  plan: PlanTier,
  interval: BillingInterval,
): Promise<{ ok: true } | { error: string }> {
  const sub = await getSubscription(supabase, agencyId);
  if (!sub?.stripe_subscription_id) return { error: "No active subscription to change." };
  const priceId = getPriceId(plan, interval);
  if (!priceId) return { error: "That plan isn't configured yet." };

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = subscription.items.data[0];
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "always_invoice",
      metadata: { ...subscription.metadata, plan, billing_interval: interval },
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not change plan." };
  }
}

/** Cancel at period end (keeps access until the paid period ends). */
export async function cancelAtPeriodEnd(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ ok: true } | { error: string }> {
  const sub = await getSubscription(supabase, agencyId);
  if (!sub?.stripe_subscription_id) return { error: "No active subscription to cancel." };
  try {
    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not schedule cancellation." };
  }
}

/** Days remaining in a trial (null when not trialing). */
function trialDaysLeft(sub: SubscriptionRow, now: Date): number | null {
  if (sub.status !== "trialing" || !sub.trial_end) return null;
  return Math.ceil((new Date(sub.trial_end).getTime() - now.getTime()) / 86_400_000);
}

/** Pause the newest active sites down to `keep` (downgrade / cap enforcement). */
async function pauseNewestOver(
  supabase: SupabaseClient,
  agencyId: string,
  keep: number,
): Promise<number> {
  const { data: active } = await supabase
    .from("clients")
    .select("id, created_at")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const rows = active ?? [];
  if (rows.length <= keep) return 0;
  const toPause = rows.slice(keep).map((r) => r.id as string);
  await supabase.from("clients").update({ is_active: false }).in("id", toPause);
  return toPause.length;
}

/**
 * Daily reconciliation (cron, service role):
 *  - send the day-12 trial reminder (once) when a trial is ~2 days from ending,
 *  - pause every active site for agencies whose subscription ended (canceled /
 *    unpaid) or that never started a trial past the grace window,
 *  - on a downgrade, pause the newest sites over the new plan's cap.
 */
export async function reconcileBilling(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{ reminded: number; paused: number }> {
  let reminded = 0;
  let paused = 0;

  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "agency_id, stripe_customer_id, stripe_subscription_id, status, plan, billing_interval, trial_end, cancel_at_period_end, current_period_end, trial_reminder_sent_at",
    );

  for (const raw of subs ?? []) {
    const sub = raw as SubscriptionRow & { trial_reminder_sent_at: string | null };
    const agencyId = sub.agency_id;

    // Day-12 trial reminder (trial ends in <= TRIAL_DAYS - TRIAL_REMINDER_DAY days).
    const left = trialDaysLeft(sub, now);
    if (
      left != null &&
      left <= TRIAL_DAYS - TRIAL_REMINDER_DAY &&
      left >= 0 &&
      !sub.trial_reminder_sent_at
    ) {
      const sent = await sendTrialReminder(supabase, sub, left, now);
      if (sent) {
        await supabase
          .from("subscriptions")
          .update({ trial_reminder_sent_at: now.toISOString() })
          .eq("agency_id", agencyId);
        reminded++;
      }
    }

    if (isEntitled(sub.status)) {
      // Entitled: enforce the plan's site cap (catches downgrades). Skip until
      // the plan has synced from Stripe, so we never pause a paid agency blindly.
      if (sub.plan) paused += await pauseNewestOver(supabase, agencyId, siteCap(sub.plan));
    } else if (sub.status === "canceled" || sub.status === "unpaid") {
      // Subscription ended — pause everything.
      paused += await pauseNewestOver(supabase, agencyId, 0);
    }
  }

  // Agencies that never subscribed: pause their preview site after the grace.
  const { data: agencies } = await supabase.from("agencies").select("id, created_at");
  for (const a of agencies ?? []) {
    const sub = await getSubscription(supabase, a.id as string);
    if (isEntitled(sub?.status)) continue;
    if (sub?.status === "canceled" || sub?.status === "unpaid") continue; // handled above
    const age = (now.getTime() - new Date(a.created_at as string).getTime()) / 86_400_000;
    if (age <= START_GRACE_DAYS) continue; // still in the start grace
    paused += await pauseNewestOver(supabase, a.id as string, 0);
  }

  return { reminded, paused };
}

/** Send the trial-ending reminder to the agency owner. Returns false on skip. */
async function sendTrialReminder(
  supabase: SupabaseClient,
  sub: SubscriptionRow,
  daysLeft: number,
  now: Date,
): Promise<boolean> {
  const { data: agency } = await supabase
    .from("agencies")
    .select("name, alert_email, owner_id")
    .eq("id", sub.agency_id)
    .single();
  if (!agency) return false;

  let recipient = agency.alert_email as string | null;
  if (!recipient) {
    try {
      const { data } = await supabase.auth.admin.getUserById(agency.owner_id as string);
      recipient = data.user?.email ?? null;
    } catch {
      recipient = null;
    }
  }
  if (!recipient) return false;

  const plan = sub.plan ? PLANS[sub.plan] : PLANS.solo;
  const { subject, html } = renderTrialReminderEmail({
    agencyName: agency.name as string,
    plan,
    interval: sub.billing_interval ?? "year",
    daysLeft: Math.max(0, daysLeft),
    trialEnd: sub.trial_end,
    siteUrl: siteUrl(),
    now,
  });
  const res = await sendEmail({ to: recipient, subject, html });
  return res.ok;
}

// Re-exports so existing importers keep working through the model change.
export { TRIAL_DAYS, siteCap, smallestPlanFor };
