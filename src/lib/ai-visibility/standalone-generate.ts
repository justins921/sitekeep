import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { queryPerplexity, SONAR_MODEL } from "./providers/perplexity";
import { detectMention, brandTermsFor } from "./mention";
import { estimateRunCost, PROMPT_CAP, DEFAULT_PROMPT_COUNT, SONAR_COST_PER_REQUEST } from "./cost";
import { demoStandalone } from "./providers/standalone";
import type { AiVisibility, AiPromptResult, AiEngineCitation } from "./types";

// Standalone GENERATION — cron/service-role only. Reads tracked prompts (or
// seeds them from GSC top queries), runs one grounded Sonar call per prompt,
// detects brand mentions, builds the normalized AiVisibility, and stores a
// snapshot with the per-run cost. Never called from a user-facing path.

export type GenerateResult = {
  clientId: string;
  stored: boolean;
  demo: boolean;
  promptCount: number;
  mentionedCount: number;
  costUsd: number;
  skippedReason?: string;
};

type ClientRow = { id: string; company_name: string; website_url: string };

export type StandaloneTarget = {
  client: ClientRow;
  config: Record<string, unknown>;
  cadenceDays: number; // min days between runs (monthly=28, weekly=6)
};

const ENTITLED_STATUSES = ["active", "trialing"];

/**
 * Clients eligible for a standalone run: their agency's ai_visibility flag is
 * ENABLED with variant 'standalone' AND the agency is subscribed (entitled).
 * Only active clients. Config (cadence/extraModels) rides on the flag override.
 */
export async function listStandaloneTargets(admin: SupabaseClient): Promise<StandaloneTarget[]> {
  const { data: flags } = await admin
    .from("agency_feature_flags")
    .select("agency_id, enabled, variant, config")
    .eq("flag_key", "ai_visibility")
    .eq("enabled", true)
    .eq("variant", "standalone");

  const targets: StandaloneTarget[] = [];
  for (const f of flags ?? []) {
    const agencyId = f.agency_id as string;
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (!sub || !ENTITLED_STATUSES.includes(sub.status as string)) continue;

    const { data: clients } = await admin
      .from("clients")
      .select("id, company_name, website_url")
      .eq("agency_id", agencyId)
      .eq("is_active", true);

    const config = (f.config as Record<string, unknown>) ?? {};
    const cadenceDays = config.cadence === "weekly" ? 6 : 28;
    for (const c of clients ?? []) {
      targets.push({ client: c as ClientRow, config, cadenceDays });
    }
  }
  return targets;
}

/** True when a fresh-enough snapshot already exists (skip to respect cadence). */
export async function hasRecentSnapshot(
  admin: SupabaseClient,
  clientId: string,
  withinDays: number,
  now: Date,
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - withinDays * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("ai_visibility_snapshots")
    .select("id")
    .eq("client_id", clientId)
    .gte("captured_at", cutoff)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Enabled tracked prompts (capped). Seeds from GSC top queries when empty. */
async function getTrackedPrompts(admin: SupabaseClient, clientId: string): Promise<string[]> {
  const { data } = await admin
    .from("ai_visibility_prompts")
    .select("text")
    .eq("client_id", clientId)
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(PROMPT_CAP);

  let prompts = (data ?? []).map((r) => r.text as string).filter(Boolean);
  if (prompts.length > 0) return prompts.slice(0, PROMPT_CAP);

  // Auto-suggest from the latest Search Console snapshot's top queries.
  const suggested = await suggestFromGsc(admin, clientId);
  if (suggested.length > 0) {
    await admin.from("ai_visibility_prompts").insert(
      suggested.map((text) => ({ client_id: clientId, text, source: "gsc" as const })),
    );
    prompts = suggested;
  }
  return prompts.slice(0, PROMPT_CAP);
}

/** Up to DEFAULT_PROMPT_COUNT prompt candidates from GSC top queries. */
async function suggestFromGsc(admin: SupabaseClient, clientId: string): Promise<string[]> {
  const { data } = await admin
    .from("metric_snapshots")
    .select("data")
    .eq("client_id", clientId)
    .eq("service_type", "search_console")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const queries = (data?.data as { top_queries?: Array<{ query?: string }> } | null)?.top_queries ?? [];
  return queries
    .map((q) => (q.query ?? "").trim())
    .filter(Boolean)
    .slice(0, DEFAULT_PROMPT_COUNT);
}

function scoreFromRate(rate: number): { pct: number; label: AiVisibility["scoreLabel"] } {
  const pct = Math.round(rate * 100);
  const label = pct >= 67 ? "great" : pct >= 34 ? "good" : "poor";
  return { pct, label };
}

function build(
  client: ClientRow,
  prompts: AiPromptResult[],
  model: string,
  demo: boolean,
): AiVisibility {
  const mentioned = prompts.filter((p) => p.mentioned).length;
  const rate = prompts.length ? mentioned / prompts.length : 0;
  const { pct, label } = scoreFromRate(rate);

  const engines: AiEngineCitation[] = [
    {
      key: "perplexity",
      name: "Perplexity",
      cited: mentioned > 0,
      statusLabel: mentioned > 0 ? "Cited" : "Not cited yet",
    },
  ];

  return {
    scoreLabel: label,
    scorePct: pct,
    explanation: `Grounded search (Perplexity Sonar) mentioned ${client.company_name} in ${mentioned} of ${prompts.length} tracked prompts.`,
    isNewSite: false,
    engines,
    citedCount: engines.filter((e) => e.cited).length,
    whatsWorking: mentioned > 0
      ? [{ title: "Cited by grounded search", detail: `Surfaced for ${mentioned} of ${prompts.length} tracked queries on Perplexity.` }]
      : [],
    holdingBack: mentioned < prompts.length
      ? [{ title: "Missing from some queries", detail: `Not surfaced for ${prompts.length - mentioned} of ${prompts.length} tracked queries — a content/authority gap.` }]
      : [],
    keywordThemes: [{ label: "Tracked prompts", keywords: prompts.map((p) => p.prompt) }],
    recommendations: [
      { title: "Strengthen third-party citations", detail: "Grounded engines cite high-authority directories and local press; grow presence there.", impact: "high" },
      { title: "Publish FAQ-structured content", detail: "Answer the tracked queries directly on dedicated pages with FAQ schema.", impact: "medium" },
    ],
    competitors: [],
    prompts,
    lastRefreshedAt: new Date().toISOString(),
    stale: false,
    processing: false,
    source: { label: "SiteKeep", variant: "standalone", demo },
  };
}

/**
 * Run the standalone pipeline for one client and store a snapshot. Cost control:
 * prompts are capped, only Sonar runs by default, and the per-run cost is logged
 * on the snapshot. With no PERPLEXITY_API_KEY, stores a labeled demo snapshot.
 */
export async function generateForClient(
  admin: SupabaseClient,
  client: ClientRow,
  config: Record<string, unknown> = {},
): Promise<GenerateResult> {
  const prompts = await getTrackedPrompts(admin, client.id);
  if (prompts.length === 0) {
    return { clientId: client.id, stored: false, demo: false, promptCount: 0, mentionedCount: 0, costUsd: 0, skippedReason: "no prompts (and no GSC queries to seed from)" };
  }

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  const extraModels = config.extraModels === true;
  const terms = brandTermsFor(client.company_name, client.website_url);

  let data: AiVisibility;
  let provider: string;
  let cost = 0;

  if (!apiKey) {
    // Demo path: label clearly, store zero cost so the card renders pre-key.
    data = { ...demoStandalone(), keywordThemes: [{ label: "Tracked prompts", keywords: prompts }] };
    provider = "demo";
  } else {
    const results: AiPromptResult[] = [];
    for (const prompt of prompts) {
      const answer = await queryPerplexity(prompt, apiKey);
      cost += SONAR_COST_PER_REQUEST;
      if (!answer) {
        results.push({ prompt, engine: "perplexity", mentioned: false, snippet: null });
        continue;
      }
      const m = detectMention(answer.text, terms);
      results.push({ prompt, engine: "perplexity", mentioned: m.mentioned, snippet: m.snippet });
    }
    data = build(client, results, SONAR_MODEL, false);
    provider = "perplexity";
    cost = estimateRunCost(prompts.length, extraModels);
  }

  const { error } = await admin.from("ai_visibility_snapshots").insert({
    client_id: client.id,
    provider,
    model: provider === "perplexity" ? SONAR_MODEL : null,
    data,
    prompt_count: prompts.length,
    cost_usd: cost,
    trigger: "cron",
  });

  const mentionedCount = data.prompts.filter((p) => p.mentioned).length;
  return {
    clientId: client.id,
    stored: !error,
    demo: provider === "demo",
    promptCount: prompts.length,
    mentionedCount,
    costUsd: cost,
    skippedReason: error?.message,
  };
}
