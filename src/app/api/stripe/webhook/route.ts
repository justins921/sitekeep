import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe";
import { isPlanTier, isBillingInterval } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";

// Needs the Node runtime for raw-body access + signature verification.
export const runtime = "nodejs";

type SubUpdate = {
  status?: string;
  plan?: string | null;
  billing_interval?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string | null;
  updated_at: string;
};

/** current_period_end lives on the subscription (older) or its item (newer). */
function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number };
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number };
  const unix = s.current_period_end ?? item?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

/** Resolve plan + interval from the subscription metadata, then the price id. */
function planInterval(sub: Stripe.Subscription): { plan: string | null; interval: string | null } {
  const metaPlan = sub.metadata?.plan;
  const metaInterval = sub.metadata?.billing_interval;
  if (isPlanTier(metaPlan) && isBillingInterval(metaInterval)) {
    return { plan: metaPlan, interval: metaInterval };
  }
  const priceId = sub.items?.data?.[0]?.price?.id;
  const mapped = planForPriceId(priceId);
  return { plan: mapped?.plan ?? metaPlan ?? null, interval: mapped?.interval ?? metaInterval ?? null };
}

function subFields(sub: Stripe.Subscription, status?: string): SubUpdate {
  const { plan, interval } = planInterval(sub);
  return {
    status: status ?? sub.status,
    plan,
    billing_interval: interval,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    stripe_subscription_id: sub.id,
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    current_period_end: periodEnd(sub),
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig ?? "", secret);
  } catch (err) {
    // Missing/invalid signature → reject.
    const msg = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const updateByAgency = (agencyId: string, fields: SubUpdate) =>
    admin.from("subscriptions").update(fields).eq("agency_id", agencyId);
  const updateByCustomer = (customerId: string, fields: SubUpdate) =>
    admin.from("subscriptions").update(fields).eq("stripe_customer_id", customerId);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const agencyId = session.client_reference_id;
        if (agencyId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          await updateByAgency(agencyId, subFields(sub));

          // Activate the dashboard the agency was paying to unlock.
          const pendingClientId = sub.metadata?.pending_client_id;
          if (pendingClientId) {
            await admin
              .from("clients")
              .update({ is_active: true })
              .eq("id", pendingClientId)
              .eq("agency_id", agencyId);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = sub.metadata?.agency_id;
        const fields = subFields(sub);
        if (agencyId) await updateByAgency(agencyId, fields);
        else await updateByCustomer(fields.stripe_customer_id!, fields);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const agencyId = sub.metadata?.agency_id;
        const fields = subFields(sub, "canceled");
        if (agencyId) await updateByAgency(agencyId, fields);
        else await updateByCustomer(fields.stripe_customer_id!, fields);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;
        const status = event.type === "invoice.paid" ? "active" : "past_due";
        await updateByCustomer(customerId, {
          status,
          updated_at: new Date().toISOString(),
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "handler error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
