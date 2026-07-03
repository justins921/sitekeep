import "server-only";
import Stripe from "stripe";

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

export const PRICE_DOLLARS = 3; // $3 per dashboard / month

/** The configured recurring price id, or null when it still needs bootstrapping. */
export function getPriceId(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || null;
}
