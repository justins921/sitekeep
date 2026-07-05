import "server-only";
import type { AiVisibility, AiVisibilityResult, AiSource } from "@/lib/ai-visibility/types";

// Standalone provider (variant 'standalone') — SiteKeep's own AI-visibility
// pipeline. Phase B ships a labeled DEMO so standalone-flagged agencies render
// through the unified card; Phase C replaces this with the real LLM pipeline
// (search-grounded prompts, monthly cron, cost controls, stored snapshots).

const SOURCE: AiSource = { label: "SiteKeep", variant: "standalone", demo: true };

function demoData(): AiVisibility {
  return {
    scoreLabel: "good",
    scorePct: 66,
    explanation:
      "Demo data — connect a grounded-LLM key (Perplexity Sonar) to run real prompts. This preview shows how the standalone source renders in the unified card.",
    isNewSite: false,
    engines: [
      { key: "chatgpt", name: "ChatGPT", cited: true, statusLabel: "Cited" },
      { key: "perplexity", name: "Perplexity", cited: true, statusLabel: "Cited" },
      { key: "gemini", name: "Gemini", cited: false, statusLabel: "Not cited yet" },
      { key: "ai_overview", name: "AI Overview", cited: false, statusLabel: "Not cited yet" },
      { key: "ai_mode", name: "AI Mode", cited: false, statusLabel: "Not cited yet" },
    ],
    citedCount: 2,
    whatsWorking: [
      { title: "Cited by conversational engines", detail: "ChatGPT and Perplexity surface the brand for core service queries." },
    ],
    holdingBack: [
      { title: "Absent from Google's AI surfaces", detail: "No presence in AI Overview or AI Mode for local queries yet." },
    ],
    keywordThemes: [
      { label: "Tracked prompts", keywords: ["best physical therapy near me", "sports injury rehab"] },
    ],
    recommendations: [
      { title: "Add structured FAQ content", detail: "Grounded engines cite FAQ-structured pages for informational queries.", impact: "high" },
    ],
    competitors: [],
    prompts: [
      { prompt: "best physical therapy in Oshkosh WI", engine: "perplexity", mentioned: true, snippet: "…includes Fox Valley Physical Therapy among top-rated clinics…" },
      { prompt: "sports injury rehabilitation near me", engine: "chatgpt", mentioned: false, snippet: null },
    ],
    lastRefreshedAt: null,
    stale: false,
    processing: false,
    source: SOURCE,
  };
}

export async function runStandaloneAiVisibility(
  clientId: string,
  config: Record<string, unknown>,
): Promise<AiVisibilityResult> {
  // Phase C: read tracked prompts, run the grounded-LLM pipeline (or return this
  // labeled demo when no key is configured), apply cost controls, store snapshot.
  void clientId;
  void config;
  return { ok: true, data: demoData() };
}
