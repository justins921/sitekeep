// Affiliate/upsell tools SiteKeep nudges agencies toward when they spot an
// opportunity (weak AI visibility, thin GBP, etc.). Links are read from env so
// they can change without a deploy. These render ONLY on the agency-facing
// dashboard — never on a white-label public client dashboard.

export type AffiliateTool = {
  key: string;
  name: string;
  url: string;
  blurb: string;
};

/** Configured affiliate tools. A tool is shown only if its URL is set. */
export function affiliateTools(): AffiliateTool[] {
  const clicks = process.env.CLICKS_AFFILIATE_URL?.trim() || "https://clicks.so/?ref=justin";
  const semflow = process.env.SEMFLOW_AFFILIATE_URL?.trim() || "";

  const tools: AffiliateTool[] = [];
  if (clicks) {
    tools.push({
      key: "clicks",
      name: "Clicks",
      url: clicks,
      blurb: "Track AI-search visibility across ChatGPT, Perplexity, Gemini & Google AI, with competitor comparison.",
    });
  }
  if (semflow) {
    tools.push({
      key: "semflow",
      name: "Semflow",
      url: semflow,
      blurb: "SEO workflows and content optimization to grow organic + AI search presence.",
    });
  }
  return tools;
}
