import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSubscription, isEntitled } from "@/lib/billing";

// Post-signup activation checklist — five steps computed from real account state,
// each with a link to where it's completed. The dashboard shows it until every
// step is done (or the owner dismisses it).

export type ChecklistStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
};

export type OnboardingChecklist = {
  steps: ChecklistStep[];
  completed: number;
  total: number;
  allDone: boolean;
};

export async function getOnboardingChecklist(
  supabase: SupabaseClient,
  agency: { id: string; logo_url: string | null; alert_email: string | null },
): Promise<OnboardingChecklist> {
  const [{ count: clientCount }, sub, agencyClientIds] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id),
    getSubscription(supabase, agency.id),
    supabase.from("clients").select("id").eq("agency_id", agency.id),
  ]);

  const ids = (agencyClientIds.data ?? []).map((c) => c.id as string);

  // "Saw a Keep Score" — any weekly rollup exists for one of this agency's sites.
  let scored = false;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("keep_score_weeks")
      .select("client_id", { count: "exact", head: true })
      .in("client_id", ids);
    scored = (count ?? 0) > 0;
  }

  const hasSite = (clientCount ?? 0) > 0;
  const entitled = isEntitled(sub?.status);

  const steps: ChecklistStep[] = [
    {
      key: "site",
      title: "Add your first site",
      description: "Start monitoring a client site and it gets a Keep Score.",
      href: "/dashboard/clients/new",
      cta: "Add a site",
      done: hasSite,
    },
    {
      key: "trial",
      title: "Start your 14-day trial",
      description: "Add a card to keep monitoring running past the trial — cancel any time.",
      href: "/dashboard/billing",
      cta: "Choose a plan",
      done: entitled,
    },
    {
      key: "score",
      title: "See your first Keep Score",
      description: "Open a site and run a health check to get its first score.",
      href: "/dashboard",
      cta: "Open a site",
      done: scored,
    },
    {
      key: "branding",
      title: "Add your logo and color",
      description: "White-label the client dashboards and recaps as your agency.",
      href: "/dashboard/settings",
      cta: "Set branding",
      done: Boolean(agency.logo_url),
    },
    {
      key: "recap",
      title: "Set your reply-to email",
      description: "So weekly recaps reach clients from your agency, not SiteKeep.",
      href: "/dashboard/settings",
      cta: "Add email",
      done: Boolean(agency.alert_email),
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  return { steps, completed, total: steps.length, allDone: completed === steps.length };
}
