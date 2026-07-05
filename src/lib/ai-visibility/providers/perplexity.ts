import "server-only";

// One search-grounded LLM call (Perplexity Sonar) per tracked prompt. Sonar
// answers with live web grounding + citations, which is what we need to judge
// whether a brand is surfaced for a query. Returns null on any failure so the
// pipeline can degrade to demo/partial rather than throw.

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
export const SONAR_MODEL = "sonar";
const TIMEOUT_MS = 30_000;

export type PerplexityAnswer = { text: string; citations: string[] };

export async function queryPerplexity(
  prompt: string,
  apiKey: string,
): Promise<PerplexityAnswer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: SONAR_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a search assistant. Answer the user's question concisely and name the specific businesses or brands you would recommend, as a real user would see.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
      search_results?: Array<{ url?: string }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    const citations =
      json.citations ??
      (json.search_results ?? []).map((s) => s.url ?? "").filter(Boolean);
    return { text, citations };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
