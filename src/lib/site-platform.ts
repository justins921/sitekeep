// Detect which website builder a client's site is made with. Used as a HIDDEN
// targeting check for upsells — e.g. Semflow only works on Webflow/Framer sites,
// so we only nudge it when we can confirm the platform. detectPlatform() is pure
// (unit-tested); detectSitePlatform() fetches the homepage HTML and runs it.

export type SitePlatform = "webflow" | "framer" | "wordpress" | "shopify" | "other";

/** Platforms Semflow supports (SEO tooling built for these builders). */
export const SEMFLOW_PLATFORMS: SitePlatform[] = ["webflow", "framer"];

/**
 * Classify a site from its HTML (and optional `server` response header).
 *
 * IMPORTANT: we key off RUNTIME markers a published builder always emits
 * (data-wf-page, the Framer runtime, generator meta) and the hosting header —
 * never off asset-CDN URLs like website-files.com or framerusercontent.com. Those
 * survive a migration: a site rebuilt on Vercel can still hotlink old Webflow
 * images, which would otherwise read as a false "webflow" (this bit us on a real
 * client). So asset hotlinks are deliberately NOT a signal.
 */
export function detectPlatform(html: string, opts: { server?: string | null } = {}): SitePlatform {
  const h = html.toLowerCase();
  const server = (opts.server ?? "").toLowerCase();

  // Framer — its runtime/generator, or a Framer hosting header.
  if (
    server.includes("framer") ||
    /content=["']framer/.test(h) ||
    h.includes("data-framer-") ||
    h.includes("__framer")
  ) {
    return "framer";
  }

  // Webflow — data-wf-* runtime attributes, generator meta, or a Webflow header.
  // (NOT website-files.com — that CDN is hotlinkable and outlives a migration.)
  if (
    server.includes("webflow") ||
    h.includes("data-wf-page") ||
    h.includes("data-wf-site") ||
    /content=["']webflow/.test(h)
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
    const server = res.headers.get("server");
    const html = (await res.text()).slice(0, 200_000); // cap: signatures are in <head>
    return detectPlatform(html, { server });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
