import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import {
  countActiveDashboards,
  getSubscription,
  isEntitled,
} from "@/lib/billing";
import { PRICE_DOLLARS, getPriceId } from "@/lib/stripe";
import { Badge, Card, StatCard } from "@/components/ui";
import { BillingButtons } from "./BillingButtons";

const STATUS_TONE: Record<string, "green" | "orange" | "neutral"> = {
  active: "green",
  trialing: "green",
  past_due: "orange",
  canceled: "neutral",
  inactive: "neutral",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { agency, role } = await requireAgency();
  // Billing is owner-only; members are sent back to the dashboard.
  if (role !== "owner") redirect("/dashboard");
  const { checkout } = await searchParams;
  const supabase = await createClient();

  const [sub, activeCount] = await Promise.all([
    getSubscription(supabase, agency.id),
    countActiveDashboards(supabase, agency.id),
  ]);

  const status = sub?.status ?? "inactive";
  const subscribed = isEntitled(status);
  const monthly = subscribed ? activeCount * PRICE_DOLLARS : 0;
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
      <p className="mt-1 text-muted">
        ${PRICE_DOLLARS} per active dashboard / month. Your first dashboard is
        free for its first 30 days.
      </p>

      {checkout === "success" && (
        <p className="mt-4 rounded-xl bg-fill-green px-4 py-3 text-sm text-accent-green">
          Payment received. Your subscription will appear here momentarily.
        </p>
      )}
      {checkout === "cancel" && (
        <p className="mt-4 rounded-xl bg-canvas-alt px-4 py-3 text-sm text-muted">
          Checkout canceled — no changes were made.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col justify-center p-5">
          <p className="text-sm font-medium text-muted">Plan status</p>
          <div className="mt-2">
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>
              {subscribed ? "Active" : status === "past_due" ? "Past due" : "Free tier"}
            </Badge>
          </div>
        </Card>
        <StatCard label="Active dashboards" value={activeCount} />
        <StatCard label="Est. monthly" value={`$${monthly}`} unit="/mo" />
      </div>

      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">
              {subscribed ? "You're subscribed" : "Free tier"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {subscribed
                ? `Renews ${periodEnd}. Quantity tracks your active dashboards.`
                : `Your first dashboard is free for 30 days. Each additional dashboard is $${PRICE_DOLLARS}/mo, charged when you add it.`}
            </p>
          </div>
          <BillingButtons
            subscribed={subscribed}
            canManage={Boolean(sub?.stripe_customer_id)}
          />
        </div>
      </Card>

      {!getPriceId() && (
        <p className="mt-4 text-xs text-muted">
          Billing is not fully configured — set <code>NEXT_PUBLIC_STRIPE_PRICE_ID</code>{" "}
          in the environment.
        </p>
      )}
    </div>
  );
}
