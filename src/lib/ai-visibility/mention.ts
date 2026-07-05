// Pure brand mention-detection for the standalone AI-visibility pipeline. Given
// an LLM's answer text and a set of brand terms, decide whether the brand was
// mentioned and pull a short snippet around the first hit. Import-light (no
// runtime imports) so it unit-tests with node --test.

export type MentionResult = { mentioned: boolean; snippet: string | null };

/** Lowercase, collapse whitespace, strip most punctuation to word boundaries. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Derive candidate brand terms from a company name + website URL. Includes the
 * full company name, a "significant words" variant (drops generic suffixes), and
 * the bare domain label (foxvalleyphysicaltherapy). Terms shorter than 3 chars
 * are dropped to avoid false positives.
 */
export function brandTermsFor(companyName: string, websiteUrl: string): string[] {
  const terms = new Set<string>();
  const name = (companyName ?? "").trim();
  if (name) terms.add(name.toLowerCase());

  // Drop generic legal/industry suffixes for a looser match.
  const GENERIC = new Set([
    "llc", "inc", "co", "company", "clinic", "and", "the", "of", "wellness",
    "services", "group", "center", "centre",
  ]);
  const sig = normalize(name)
    .split(" ")
    .filter((w) => w.length > 2 && !GENERIC.has(w));
  if (sig.length >= 2) terms.add(sig.join(" "));

  // Domain label without scheme/www/TLD.
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0];
    if (label && label.length > 2) terms.add(label.toLowerCase());
  } catch {
    // ignore malformed URLs
  }

  return [...terms].filter(Boolean);
}

/**
 * True when any brand term appears in the text (word-ish match on the normalized
 * strings). Returns a ~160-char snippet centered on the first match.
 */
export function detectMention(text: string, brandTerms: string[]): MentionResult {
  if (!text || brandTerms.length === 0) return { mentioned: false, snippet: null };
  const hay = normalize(text);

  for (const raw of brandTerms) {
    const term = normalize(raw);
    if (!term) continue;
    const idx = hay.indexOf(term);
    if (idx !== -1) {
      // Map back to a snippet from the ORIGINAL text by proportional position.
      const ratio = idx / hay.length;
      const approx = Math.floor(ratio * text.length);
      const start = Math.max(0, approx - 70);
      const end = Math.min(text.length, approx + 90);
      let snippet = text.slice(start, end).trim();
      if (start > 0) snippet = "…" + snippet;
      if (end < text.length) snippet = snippet + "…";
      return { mentioned: true, snippet };
    }
  }
  return { mentioned: false, snippet: null };
}
