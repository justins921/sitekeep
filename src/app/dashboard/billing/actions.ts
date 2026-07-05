"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveMembership } from "@/lib/agency";
import { getStripe } from "@/lib/stripe";
import {
  countActiveDashboards,
  createCheckoutUrl,
  getAgencyCreatedAt,
  getSubscription,
  paidSeatsFor,
} from "@/lib/billing";

export type BillingActionResult = { url: string } | { error: string };

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

export async function createCheckoutSession(): Promise<BillingActionResult> {
  const { supabase, agencyId, email } = await requireOwnerAgency();
  const [active, createdAt] = await Promise.all([
    countActiveDashboards(supabase, agencyId),
    getAgencyCreatedAt(supabase, agencyId),
  ]);
  const quantity = Math.max(paidSeatsFor(active, createdAt), 1);
  return createCheckoutUrl(supabase, agencyId, email, { quantity });
}

export async function createPortalSession(): Promise<BillingActionResult> {
  const { supabase, agencyId } = await requireOwnerAgency();
  const sub = await getSubscription(supabase, agencyId);
  if (!sub?.stripe_customer_id) {
    return { error: "Subscribe first, then you can manage billing." };
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
