import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PlanTier } from "./plans";

/**
 * Server-only Stripe client. STRIPE_SECRET_KEY must be a secret (test:
 * sk_test_…) and is NEVER exposed to the browser. Import this only from server
 * actions, route handlers and the webhook.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  cached = new Stripe(key, { appInfo: { name: "SiteKeep" } });
  return cached;
}

// One Stripe price per (plan, interval). Configure via env, e.g.
//   STRIPE_PRICE_SOLO_MONTH=price_… STRIPE_PRICE_AGENCY_YEAR=price_…
const PRICE_ENV: Record<PlanTier, Record<BillingInterval, string>> = {
  solo: { month: "STRIPE_PRICE_SOLO_MONTH", year: "STRIPE_PRICE_SOLO_YEAR" },
  agency: { month: "STRIPE_PRICE_AGENCY_MONTH", year: "STRIPE_PRICE_AGENCY_YEAR" },
};

/** The Stripe price id for a plan + interval, or null when not configured. */
export function getPriceId(plan: PlanTier, interval: BillingInterval): string | null {
  return process.env[PRICE_ENV[plan][interval]] || null;
}

/** Reverse-map a Stripe price id back to its plan + interval (webhook sync). */
export function planForPriceId(
  priceId: string | null | undefined,
): { plan: PlanTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of ["solo", "agency"] as PlanTier[]) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (process.env[PRICE_ENV[plan][interval]] === priceId) return { plan, interval };
    }
  }
  return null;
}

/** True when at least one plan price is configured (billing is live). */
export function billingConfigured(): boolean {
  return Boolean(
    getPriceId("solo", "month") ||
      getPriceId("solo", "year") ||
      getPriceId("agency", "month") ||
      getPriceId("agency", "year"),
  );
}
