// Detect which website builder a client's site is made with. Used as a HIDDEN
// targeting check for upsells — e.g. Semflow only works on Webflow/Framer sites,
// so we only nudge it when we can confirm the platform. detectPlatform() is pure
// (unit-tested); detectSitePlatform() fetches the homepage HTML and runs it.

export type SitePlatform = "webflow" | "framer" | "wordpress" | "shopify" | "other";

/** Platforms Semflow supports (SEO tooling built for these builders). */
export const SEMFLOW_PLATFORMS: SitePlatform[] = ["webflow", "framer"];

/** Classify a site from its raw HTML by builder-specific signatures. */
export function detectPlatform(html: string): SitePlatform {
  const h = html.toLowerCase();

  // Framer — asset host + generator + framer badge/attrs are unambiguous.
  if (
    h.includes("framerusercontent.com") ||
    h.includes("framer.com/") ||
    /content=["']framer/.test(h) ||
    h.includes("data-framer-") ||
    h.includes("__framer")
  ) {
    return "framer";
  }

  // Webflow — data-wf-* on <html>, generator meta, or the website-files.com CDN.
  if (
    h.includes("data-wf-page") ||
    h.includes("data-wf-site") ||
    /content=["']webflow/.test(h) ||
    h.includes(".website-files.com")
  ) {
    return "webflow";
  }

  // WordPress
  if (h.includes("/wp-content/") || h.includes("/wp-includes/") || /content=["']wordpress/.test(h)) {
    return "wordpress";
  }

  // Shopify
  if (h.includes("cdn.shopify.com") || h.includes("shopify.theme") || h.includes(".myshopify.com")) {
    return "shopify";
  }

  return "other";
}

/** Fetch the homepage and detect its platform. Returns null if unreachable. */
export async function detectSitePlatform(url: string): Promise<SitePlatform | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SiteKeepBot/1.0; +https://sitekeep.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000); // cap: signatures are in <head>
    return detectPlatform(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
