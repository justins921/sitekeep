import { redirect } from "next/navigation";
import { requireAgency } from "@/lib/agency";
import { createClient } from "@/lib/supabase/server";
import { countActiveDashboards, currentSiteCap, getSubscription, isEntitled } from "@/lib/billing";
import { billingConfigured } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";
import { Badge, Card, StatCard } from "@/components/ui";
import { PlanPicker } from "./PlanPicker";

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; start?: string; upgrade?: string }>;
}) {
  const { agency, role } = await requireAgency();
  // Billing is owner-only; members are sent back to the dashboard.
  if (role !== "owner") redirect("/dashboard");
  const { checkout, start, upgrade } = await searchParams;
  const supabase = await createClient();

  const [sub, activeCount] = await Promise.all([
    getSubscription(supabase, agency.id),
    countActiveDashboards(supabase, agency.id),
  ]);

  const status = sub?.status ?? "inactive";
  const subscribed = isEntitled(status);
  const trialing = status === "trialing";
  const plan = sub?.plan ? PLANS[sub.plan] : null;
  const cap = currentSiteCap(sub);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
      <p className="mt-1 text-muted">
        Pick a plan and keep every client site healthy. Start with a 14-day trial — cancel any time
        before it ends.
      </p>

      {checkout === "success" && (
        <p className="mt-4 rounded-xl bg-fill-green px-4 py-3 text-sm text-accent-green">
          Your trial is starting — your plan will appear here momentarily.
        </p>
      )}
      {checkout === "cancel" && (
        <p className="mt-4 rounded-xl bg-canvas-alt px-4 py-3 text-sm text-muted">
          Checkout canceled — no changes were made.
        </p>
      )}
      {start === "1" && !subscribed && (
        <p className="mt-4 rounded-xl bg-fill-blue px-4 py-3 text-sm text-brand">
          Start a plan below to turn on the site you just added.
        </p>
      )}
      {upgrade === "1" && subscribed && (
        <p className="mt-4 rounded-xl bg-fill-orange px-4 py-3 text-sm text-accent-orange">
          You&apos;re at your {plan?.name ?? "plan"} site limit. Switch to a larger plan to add more.
        </p>
      )}

      {subscribed && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="flex flex-col justify-center p-5">
            <p className="text-sm font-medium text-muted">Plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={trialing ? "orange" : "green"}>
                {plan?.name ?? "Active"}
                {trialing ? " · trial" : ""}
              </Badge>
              {sub?.cancel_at_period_end && <Badge tone="neutral">Cancels at period end</Badge>}
            </div>
          </Card>
          <StatCard label="Sites in use" value={`${activeCount} / ${cap}`} />
          <StatCard
            label={trialing ? "Trial ends" : sub?.cancel_at_period_end ? "Access until" : "Renews"}
            value={fmtDate(trialing ? sub?.trial_end ?? null : sub?.current_period_end ?? null)}
          />
        </div>
      )}

      <div className="mt-8">
        <PlanPicker
          currentPlan={sub?.plan ?? null}
          subscribed={subscribed}
          canManage={Boolean(sub?.stripe_customer_id)}
        />
      </div>

      {!billingConfigured() && (
        <p className="mt-6 text-xs text-muted">
          Billing is not fully configured — set the <code>STRIPE_PRICE_*</code> plan price ids in the
          environment.
        </p>
      )}
    </div>
  );
}
