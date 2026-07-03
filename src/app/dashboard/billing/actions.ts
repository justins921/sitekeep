"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const { supabase, agencyId, email } = await requireAgency();
  const [active, createdAt] = await Promise.all([
    countActiveDashboards(supabase, agencyId),
    getAgencyCreatedAt(supabase, agencyId),
  ]);
  const quantity = Math.max(paidSeatsFor(active, createdAt), 1);
  return createCheckoutUrl(supabase, agencyId, email, { quantity });
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
