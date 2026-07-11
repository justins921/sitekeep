"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { normalizeUrl, slugify } from "@/lib/utils";
import { resolveMembership } from "@/lib/agency";
import { canAddSite, countActiveDashboards, getSubscription } from "@/lib/billing";
import { recordUptimeCheck, writeUptimeSnapshot } from "@/lib/uptime";
import { computeAndStoreKeepScore } from "@/lib/keep-score";

const PENDING_SITE_COOKIE = "sk_pending_site";

// Services that back the Keep Score dimensions we can measure today — enabled by
// default on an auto-imported site so it starts scoring on the first refresh.
const DEFAULT_SERVICES = ["uptime", "page_speed", "security"] as const;

export type ImportPendingResult = { imported: false } | { imported: true; clientId: string };

/** Derive a friendly company name from a URL host (drops www + TLD casing). */
function companyNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0] ?? host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "My site";
  }
}

const randomSuffix = () => Math.random().toString(36).slice(2, 7);

/**
 * Auto-import the site a scan-first visitor scanned before signup. Reads the
 * pending-site cookie set during signup, creates it as the agency's first
 * monitored site (active under the free allowance), enables the Keep Score
 * services, records an initial uptime check, and computes a first Keep Score.
 * Idempotent-ish: clears the cookie and skips if the site already exists.
 */
export async function importPendingSite(): Promise<ImportPendingResult> {
  const store = await cookies();
  const raw = store.get(PENDING_SITE_COOKIE)?.value;
  if (!raw) return { imported: false };

  // Whatever happens below, don't retry on the next dashboard load.
  const clearCookie = () => store.delete(PENDING_SITE_COOKIE);

  let url: string | null = null;
  try {
    const parsed = JSON.parse(raw) as { url?: string };
    url = normalizeUrl(String(parsed.url ?? ""));
  } catch {
    url = null;
  }
  if (!url) {
    clearCookie();
    return { imported: false };
  }

  const supabase = await createSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { imported: false }; // not signed in yet — keep cookie, retry later

  const membership = await resolveMembership(supabase, user.id);
  if (!membership) return { imported: false };
  const agency_id = membership.agency.id;

  // Don't create a duplicate if they already have this site.
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("agency_id", agency_id)
    .eq("website_url", url)
    .maybeSingle();
  if (existing) {
    clearCookie();
    return { imported: true, clientId: existing.id as string };
  }

  const [activeCount, sub] = await Promise.all([
    countActiveDashboards(supabase, agency_id),
    getSubscription(supabase, agency_id),
  ]);
  // The scanned site imports as a live preview so the Keep Score appears at
  // once; reconcile pauses it after the start grace if no trial is begun.
  // Any further import respects the plan's site cap.
  const is_active = activeCount === 0 || canAddSite(sub, activeCount);

  const base = slugify(companyNameFromUrl(url)) || "site";
  let newId: string | null = null;
  for (let attempt = 0; attempt < 6 && !newId; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("clients")
      .insert({
        agency_id,
        company_name: companyNameFromUrl(url),
        website_url: url,
        contact_email: null,
        monthly_rate: 0,
        slug,
        is_active,
      })
      .select("id")
      .single();
    if (!error && data) {
      newId = data.id as string;
      break;
    }
    if (error && error.code !== "23505") {
      clearCookie();
      return { imported: false };
    }
  }
  if (!newId) {
    clearCookie();
    return { imported: false };
  }

  // Enable the Keep Score services so scheduled/manual refreshes fill them in.
  await supabase.from("client_services").insert(
    DEFAULT_SERVICES.map((service_type) => ({
      client_id: newId,
      service_type,
      enabled: true,
    })),
  );

  // Best-effort initial data so the site isn't blank: one uptime check + a first
  // Keep Score. Heavier providers (PageSpeed, security) run on the next refresh.
  try {
    await recordUptimeCheck(supabase, newId, url);
    await writeUptimeSnapshot(supabase, newId, new Date());
    await computeAndStoreKeepScore(supabase, newId, new Date());
  } catch {
    // Non-fatal — the site is created; the next refresh will populate it.
  }

  clearCookie();
  revalidatePath("/dashboard");
  return { imported: true, clientId: newId };
}
