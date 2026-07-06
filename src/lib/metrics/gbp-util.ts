// Pure parsing for the Google Places "Place Details" response → GoogleBusinessData.
// Import-light (type-only) so it unit-tests with node --test. No network here.
import type { GbpChecklistItem, GbpReview, GoogleBusinessData } from "./types";

/** The subset of a Places Details result we read. */
export type PlaceDetailsResult = {
  place_id?: string;
  name?: string;
  url?: string; // Google Maps URL
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  business_status?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: Array<{
    author_name?: string;
    rating?: number;
    text?: string;
    relative_time_description?: string;
  }>;
  opening_hours?: { weekday_text?: string[] };
  photos?: Array<unknown>;
};

/** Build the completeness checklist from a place result. */
export function computeChecklist(r: PlaceDetailsResult): GbpChecklistItem[] {
  const total = typeof r.user_ratings_total === "number" ? r.user_ratings_total : 0;
  return [
    { key: "website", label: "Website linked", ok: Boolean(r.website) },
    { key: "phone", label: "Phone number", ok: Boolean(r.formatted_phone_number || r.international_phone_number) },
    { key: "hours", label: "Business hours", ok: Boolean(r.opening_hours?.weekday_text?.length) },
    { key: "photos", label: "Photos added", ok: Array.isArray(r.photos) && r.photos.length > 0 },
    { key: "reviews", label: "10+ reviews", ok: total >= 10 },
    { key: "rating", label: "Rating ≥ 4.0", ok: typeof r.rating === "number" && r.rating >= 4.0 },
  ];
}

export function parsePlaceDetails(r: PlaceDetailsResult): GoogleBusinessData {
  const checklist = computeChecklist(r);
  const completeness_pct = Math.round(
    (checklist.filter((c) => c.ok).length / checklist.length) * 100,
  );
  const reviews: GbpReview[] = (r.reviews ?? []).slice(0, 5).map((rv) => ({
    author: rv.author_name ?? "Anonymous",
    rating: typeof rv.rating === "number" ? rv.rating : 0,
    text: (rv.text ?? "").trim(),
    relative: rv.relative_time_description ?? "",
  }));

  return {
    connected: true,
    demo: false,
    error: null,
    place_id: r.place_id ?? null,
    name: r.name ?? null,
    maps_url: r.url ?? null,
    address: r.formatted_address ?? null,
    phone: r.formatted_phone_number ?? r.international_phone_number ?? null,
    website: r.website ?? null,
    business_status: r.business_status ?? null,
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews_total: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    reviews,
    photos_count: Array.isArray(r.photos) ? r.photos.length : null,
    checklist,
    completeness_pct,
  };
}

/** Empty / not-connected state (no place mapped, no key, or an API error). */
export function gbpNotConnected(error: string | null = null): GoogleBusinessData {
  return {
    connected: false,
    demo: false,
    error,
    place_id: null,
    name: null,
    maps_url: null,
    address: null,
    phone: null,
    website: null,
    business_status: null,
    rating: null,
    reviews_total: null,
    reviews: [],
    photos_count: null,
    checklist: [],
    completeness_pct: 0,
  };
}
