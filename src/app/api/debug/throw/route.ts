export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY — generates a test error so we can confirm Sentry capture in prod.
 * Remove this route once the test error shows up in the Sentry dashboard.
 */
export async function GET(): Promise<Response> {
  throw new Error("SiteKeep Sentry test error (/api/debug/throw)");
}
