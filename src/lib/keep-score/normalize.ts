// Pure normalizers: raw dimension data → a 0–100 Keep Score sub-score. Returns
// null when a dimension isn't measured. Import-light for node --test.

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Uptime: successful-check percentage IS the sub-score. */
export function normalizeUptime(uptimePct: number | null | undefined): number | null {
  return typeof uptimePct === "number" ? clamp(uptimePct) : null;
}

/** Performance: the normalized Lighthouse performance score (0–100). */
export function normalizePerformance(perfScore: number | null | undefined): number | null {
  return typeof perfScore === "number" ? clamp(perfScore) : null;
}

/** Form delivery: share of synthetic submissions that reached their destination. */
export function normalizeForm(deliveryPct: number | null | undefined): number | null {
  return typeof deliveryPct === "number" ? clamp(deliveryPct) : null;
}

/** Broken links: share of internal links returning 2xx/3xx. */
export function normalizeLinks(okPct: number | null | undefined): number | null {
  return typeof okPct === "number" ? clamp(okPct) : null;
}

export type SslDomainInput = {
  sslValid: boolean | null;
  sslDaysToExpiry: number | null;
  domainDaysToExpiry: number | null; // null = not checked yet
};

/**
 * SSL & domain: an invalid cert is critical (→ low). Otherwise reward comfortable
 * runway — cert expiry ≥14 days, domain expiry ≥30 days — and dock as those
 * windows close. SSL is weighted more than domain within the dimension.
 */
export function normalizeSslDomain(input: SslDomainInput): number | null {
  if (input.sslValid == null && input.sslDaysToExpiry == null && input.domainDaysToExpiry == null) {
    return null;
  }

  // An invalid cert is critical and dominates the dimension regardless of domain runway.
  if (input.sslValid === false) return 0;

  let ssl: number;
  if (input.sslDaysToExpiry == null) ssl = 100; // valid, expiry unknown
  else if (input.sslDaysToExpiry >= 14) ssl = 100;
  else if (input.sslDaysToExpiry > 0) ssl = 60;
  else ssl = 15;

  // Domain expiry is optional; when unknown, the dimension is just the SSL part.
  if (input.domainDaysToExpiry == null) return clamp(ssl);

  let domain: number;
  if (input.domainDaysToExpiry >= 30) domain = 100;
  else if (input.domainDaysToExpiry > 0) domain = 55;
  else domain = 10;

  return clamp(0.6 * ssl + 0.4 * domain);
}
