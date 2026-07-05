// POC pilot mapping: SiteKeep client id → Clicks project id. A plain constant
// (not a DB column) keeps this throwaway plumbing trivial to delete. To promote
// later, swap this for a nullable clicks_project_id column on `clients`.
export const CLICKS_PILOT_PROJECTS: Record<string, number> = {
  // Fox Valley Physical Therapy → Clicks project 1537 (domain foxvalleyphysicaltherapy.com)
  "6cd095fd-3754-4968-9ed0-e141c8d245f8": 1537,
};

/** The Clicks project id mapped to a SiteKeep client, or null if not a pilot. */
export function clicksProjectFor(clientId: string): number | null {
  return CLICKS_PILOT_PROJECTS[clientId] ?? null;
}
