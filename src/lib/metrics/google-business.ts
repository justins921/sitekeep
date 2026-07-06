import type { GoogleBusinessData, ServiceResult } from "./types";
import { parsePlaceDetails, gbpNotConnected, type PlaceDetailsResult } from "./gbp-util";

// Google Business Profile via the public Places API (Place Details). No per-client
// OAuth and no Business Profile API approval — just a Maps/Places API key. Gives
// rating, review count + recent reviews, and profile-completeness signals — the
// concrete "opportunity" data an agency can act on. Degrades to a clean
// not-connected state (or a labeled demo when no key) rather than failing.

const DETAILS_ENDPOINT = "https://maps.googleapis.com/maps/api/place/details/json";
const FINDPLACE_ENDPOINT = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const DETAILS_FIELDS = [
  "place_id", "name", "url", "formatted_address", "formatted_phone_number",
  "international_phone_number", "website", "business_status", "rating",
  "user_ratings_total", "reviews", "opening_hours", "photos",
].join(",");
const TIMEOUT_MS = 15_000;

function apiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.GOOGLE_PLACES_API_KEY?.trim();
}

/** Whether Places-backed GBP can run (a key is configured). */
export function gbpConfigured(): boolean {
  return Boolean(apiKey());
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a Place ID from a typed business name (+ optional locality/website).
 * Used by the settings action so the agency types a name and we store the id.
 */
export async function resolvePlaceId(
  query: string,
): Promise<{ place_id: string; name: string; address: string } | null> {
  const key = apiKey();
  if (!key || !query.trim()) return null;
  const params = new URLSearchParams({
    input: query.trim(),
    inputtype: "textquery",
    fields: "place_id,name,formatted_address",
    key,
  });
  const json = await getJson(`${FINDPLACE_ENDPOINT}?${params.toString()}`);
  const cand = (json?.candidates as Array<{ place_id?: string; name?: string; formatted_address?: string }> | undefined)?.[0];
  if (!cand?.place_id) return null;
  return { place_id: cand.place_id, name: cand.name ?? "", address: cand.formatted_address ?? "" };
}

function demoData(): GoogleBusinessData {
  return {
    connected: true,
    demo: true,
    error: null,
    place_id: null,
    name: "Sample Local Business",
    maps_url: null,
    address: "123 Main St, Anytown",
    phone: "(555) 123-4567",
    website: "https://example.com",
    business_status: "OPERATIONAL",
    rating: 4.6,
    reviews_total: 42,
    reviews: [
      { author: "Jane D.", rating: 5, text: "Fantastic service, highly recommend.", relative: "2 weeks ago" },
      { author: "Mark P.", rating: 4, text: "Great experience overall.", relative: "a month ago" },
    ],
    photos_count: 8,
    checklist: [
      { key: "website", label: "Website linked", ok: true },
      { key: "phone", label: "Phone number", ok: true },
      { key: "hours", label: "Business hours", ok: true },
      { key: "photos", label: "Photos added", ok: true },
      { key: "reviews", label: "10+ reviews", ok: true },
      { key: "rating", label: "Rating ≥ 4.0", ok: true },
    ],
    completeness_pct: 100,
  };
}

/**
 * Google Business Profile provider. `placeId` comes from the client's service
 * config (resolved from a typed business name in settings). No key → labeled
 * demo; key but no mapping → clean not-connected; API error → not-connected with
 * a reason. Always succeeds (never fails the refresh).
 */
export async function runGoogleBusiness(
  _url: string,
  placeId: string | null | undefined,
): Promise<ServiceResult<GoogleBusinessData>> {
  const key = apiKey();
  if (!key) return { ok: true, data: demoData() };
  if (!placeId) {
    return { ok: true, data: gbpNotConnected("No Google Business location mapped yet.") };
  }

  const params = new URLSearchParams({ place_id: placeId, fields: DETAILS_FIELDS, key });
  const json = await getJson(`${DETAILS_ENDPOINT}?${params.toString()}`);
  if (!json) return { ok: true, data: gbpNotConnected("Couldn’t reach the Google Places API.") };

  const status = json.status as string | undefined;
  if (status !== "OK" || !json.result) {
    const msg =
      status === "NOT_FOUND" || status === "INVALID_REQUEST"
        ? "Google couldn’t find this business — re-select the location in settings."
        : (json.error_message as string) ?? `Places API returned ${status ?? "an error"}.`;
    return { ok: true, data: gbpNotConnected(msg) };
  }

  return { ok: true, data: parsePlaceDetails(json.result as PlaceDetailsResult) };
}
