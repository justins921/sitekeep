"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getPriceId } from "@/lib/stripe";
import { countActiveDashboards, getSubscription } from "@/lib/billing";

export type BillingActionResult = { url: string } | { error: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function requireAgency() {
  const supabase = await createClient();
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
  return { supabase, agencyId: agency.id as string, email: user.email ?? undefined };
}

export async function createCheckoutSession(): Promise<BillingActionResult> {
  const priceId = getPriceId();
  if (!priceId) {
    return { error: "Billing isn't configured yet. Add a price ID to continue." };
  }

  const { supabase, agencyId, email } = await requireAgency();
  const sub = await getSubscription(supabase, agencyId);
  const quantity = Math.max(await countActiveDashboards(supabase, agencyId), 1);

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity }],
      client_reference_id: agencyId,
      // Reuse the customer when we already have one; otherwise Stripe creates it
      // and the webhook persists the id.
      ...(sub?.stripe_customer_id
        ? { customer: sub.stripe_customer_id }
        : { customer_email: email }),
      subscription_data: { metadata: { agency_id: agencyId } },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/dashboard/billing?checkout=success`,
      cancel_url: `${siteUrl()}/dashboard/billing?checkout=cancel`,
    });
    if (!session.url) return { error: "Could not start checkout." };
    return { url: session.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Checkout failed." };
  }
}

export async function createPortalSession(): Promise<BillingActionResult> {
  const { supabase, agencyId } = await requireAgency();
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
