// Pure, dependency-free Search Console helpers — kept separate from gsc.ts (which
// imports the service account + does network I/O) so they can be unit-tested with
// node --test directly, no bundler.

/**
 * Normalize a Search Console property. Accepts both formats loosely:
 *  - URL-prefix:  https://www.example.com/  (kept verbatim, trailing slash added)
 *  - Domain:      sc-domain:example.com     (kept verbatim)
 * Returns null if it's clearly neither.
 */
export function normalizeGscSiteUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;
  if (/^sc-domain:/i.test(s)) {
    const host = s.slice("sc-domain:".length).trim();
    return host ? `sc-domain:${host.toLowerCase()}` : null;
  }
  if (/^https?:\/\//i.test(s)) {
    return s.endsWith("/") ? s : `${s}/`;
  }
  // A bare domain with no scheme is ambiguous — treat as a domain property.
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return `sc-domain:${s.toLowerCase()}`;
  return null;
}

/** Pure selector: REAL only with credentials AND a usable property. */
export function gscSourceFor(
  hasCredentials: boolean,
  siteUrl: string | null | undefined,
): "real" | "empty" {
  return hasCredentials && normalizeGscSiteUrl(siteUrl) ? "real" : "empty";
}
