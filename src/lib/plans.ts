// Plan catalog — the single source of truth for tiers, caps, and pricing.
// Client-safe (no server-only imports) so the pricing UI + paywall can read it.
// Stripe price IDs live in env (server) and are resolved in @/lib/stripe.

export type PlanTier = "solo" | "agency";
export type BillingInterval = "month" | "year";

export type Plan = {
  tier: PlanTier;
  name: string;
  siteCap: number;
  whiteLabel: boolean;
  price: Record<BillingInterval, number>; // USD per interval
  blurb: string;
};

/** Card-required free trial length, in days (Stripe trial). */
export const TRIAL_DAYS = 14;

/** Day within the trial to send the "ends soon" reminder (day 12 of 14). */
export const TRIAL_REMINDER_DAY = 12;

export const PLANS: Record<PlanTier, Plan> = {
  solo: {
    tier: "solo",
    name: "Solo",
    siteCap: 3,
    whiteLabel: false,
    price: { month: 12, year: 120 }, // annual = 2 months free
    blurb: "For freelancers keeping a handful of sites healthy.",
  },
  agency: {
    tier: "agency",
    name: "Agency",
    siteCap: 15,
    whiteLabel: true,
    price: { month: 29, year: 290 },
    blurb: "For agencies with white-label client dashboards & recaps.",
  },
};

export const PLAN_TIERS: PlanTier[] = ["solo", "agency"];

export function isPlanTier(v: unknown): v is PlanTier {
  return v === "solo" || v === "agency";
}

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "year";
}

/** Site cap for a tier (0 when no/unknown plan). */
export function siteCap(tier: PlanTier | null | undefined): number {
  return tier ? PLANS[tier].siteCap : 0;
}

/** Monthly-equivalent price, for comparing annual vs monthly in the UI. */
export function monthlyEquivalent(plan: Plan, interval: BillingInterval): number {
  return interval === "year" ? Math.round((plan.price.year / 12) * 100) / 100 : plan.price.month;
}

/** The smallest plan that fits `siteCount` active sites (for downgrade math). */
export function smallestPlanFor(siteCount: number): PlanTier | null {
  if (siteCount <= PLANS.solo.siteCap) return "solo";
  if (siteCount <= PLANS.agency.siteCap) return "agency";
  return null; // over the largest cap
}
