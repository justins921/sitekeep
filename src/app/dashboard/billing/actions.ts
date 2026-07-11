"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveMembership } from "@/lib/agency";
import { getStripe } from "@/lib/stripe";
import {
  cancelAtPeriodEnd,
  changePlan,
  getSubscription,
  startTrialCheckout,
} from "@/lib/billing";
import { isBillingInterval, isPlanTier } from "@/lib/plans";

export type BillingActionResult = { url: string } | { error: string };
export type BillingMutationResult = { ok: true } | { error: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Billing is OWNER-ONLY. Members are redirected back to the dashboard. */
async function requireOwnerAgency() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await resolveMembership(supabase, user.id);
  if (!membership) redirect("/join");
  if (membership.role !== "owner") redirect("/dashboard");
  return { supabase, agencyId: membership.agency.id, email: user.email ?? undefined };
}

/** Start a card-required 14-day trial on the chosen plan + interval. */
export async function startTrialAction(
  plan: string,
  interval: string,
): Promise<BillingActionResult> {
  if (!isPlanTier(plan) || !isBillingInterval(interval)) {
    return { error: "Pick a plan to continue." };
  }
  const { supabase, agencyId, email } = await requireOwnerAgency();
  return startTrialCheckout(supabase, agencyId, email, { plan, interval });
}

/** Switch to a different plan / interval on an active subscription. */
export async function changePlanAction(
  plan: string,
  interval: string,
): Promise<BillingMutationResult> {
  if (!isPlanTier(plan) || !isBillingInterval(interval)) {
    return { error: "Pick a plan to continue." };
  }
  const { supabase, agencyId } = await requireOwnerAgency();
  const res = await changePlan(supabase, agencyId, plan, interval);
  if ("ok" in res) revalidatePath("/dashboard/billing");
  return res;
}

/** Schedule cancellation at the end of the current paid period. */
export async function cancelSubscriptionAction(): Promise<BillingMutationResult> {
  const { supabase, agencyId } = await requireOwnerAgency();
  const res = await cancelAtPeriodEnd(supabase, agencyId);
  if ("ok" in res) revalidatePath("/dashboard/billing");
  return res;
}

export async function createPortalSession(): Promise<BillingActionResult> {
  const { supabase, agencyId } = await requireOwnerAgency();
  const sub = await getSubscription(supabase, agencyId);
  if (!sub?.stripe_customer_id) {
    return { error: "Start a plan first, then you can manage billing." };
  }

  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${siteUrl()}/dashboard/billing`,
    });
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not open billing portal." };
  }
}
