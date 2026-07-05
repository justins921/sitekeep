import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AiVisibility, AiVisibilityResult, AiSource } from "@/lib/ai-visibility/types";

// Standalone provider (variant 'standalone') — RENDER path. Reads the latest
// stored snapshot (written by the monthly cron) via the request-scoped RLS
// client and returns it. Falls back to a labeled DEMO when no snapshot exists
// yet (e.g. before the first cron run, or with no grounded-LLM key configured).
// Generation lives in ./standalone-generate (cron/service-role only) so a manual
// dashboard refresh never triggers a paid LLM run.

const DEMO_SOURCE: AiSource = { label: "SiteKeep", variant: "standalone", demo: true };

export function demoStandalone(): AiVisibility {
  return {
    scoreLabel: "good",
    scorePct: 66,
    explanation:
      "Demo data — configure a grounded-LLM key (Perplexity Sonar) and the monthly run will replace this with real prompt results.",
    isNewSite: false,
    engines: [
      { key: "perplexity", name: "Perplexity", cited: true, statusLabel: "Cited" },
    ],
    citedCount: 1,
    whatsWorking: [
      { title: "Surfaced by grounded search", detail: "Perplexity names the brand for core service queries." },
    ],
    holdingBack: [
      { title: "Coverage not yet measured", detail: "Add tracked prompts and run the pipeline to measure real coverage." },
    ],
    keywordThemes: [{ label: "Tracked prompts", keywords: ["best physical therapy near me"] }],
    recommendations: [
      { title: "Publish FAQ-structured content", detail: "Grounded engines cite FAQ pages for informational queries.", impact: "high" },
    ],
    competitors: [],
    prompts: [
      { prompt: "best physical therapy in Oshkosh WI", engine: "perplexity", mentioned: true, snippet: "…includes the clinic among top-rated options…" },
    ],
    lastRefreshedAt: null,
    stale: false,
    processing: false,
    source: DEMO_SOURCE,
  };
}

export async function runStandaloneAiVisibility(
  clientId: string,
  config: Record<string, unknown>,
): Promise<AiVisibilityResult> {
  void config;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_visibility_snapshots")
    .select("data, captured_at")
    .eq("client_id", clientId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.data) {
    return { ok: true, data: data.data as AiVisibility };
  }
  // No stored run yet — show the labeled demo so the card still renders.
  return { ok: true, data: demoStandalone() };
}
