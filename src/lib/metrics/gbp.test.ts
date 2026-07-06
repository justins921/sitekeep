import { test } from "node:test";
import assert from "node:assert/strict";
import { computeChecklist, parsePlaceDetails, gbpNotConnected, type PlaceDetailsResult } from "./gbp-util.ts";

const full: PlaceDetailsResult = {
  place_id: "ChIJ_test",
  name: "Fox Valley Physical Therapy",
  url: "https://maps.google.com/?cid=1",
  formatted_address: "123 Main St, Oshkosh, WI",
  formatted_phone_number: "(920) 555-0100",
  website: "https://foxvalleyphysicaltherapy.com",
  business_status: "OPERATIONAL",
  rating: 4.8,
  user_ratings_total: 42,
  opening_hours: { weekday_text: ["Monday: 8–5"] },
  photos: [{}, {}, {}],
  reviews: [
    { author_name: "Jane D.", rating: 5, text: "Great!", relative_time_description: "2 weeks ago" },
  ],
};

test("computeChecklist: all satisfied for a complete profile", () => {
  const cl = computeChecklist(full);
  assert.ok(cl.every((c) => c.ok));
  assert.deepEqual(cl.map((c) => c.key), ["website", "phone", "hours", "photos", "reviews", "rating"]);
});

test("computeChecklist: flags gaps", () => {
  const cl = computeChecklist({ rating: 3.2, user_ratings_total: 4 });
  const by = Object.fromEntries(cl.map((c) => [c.key, c.ok]));
  assert.equal(by.website, false);
  assert.equal(by.phone, false);
  assert.equal(by.hours, false);
  assert.equal(by.photos, false);
  assert.equal(by.reviews, false); // <10
  assert.equal(by.rating, false); // <4.0
});

test("parsePlaceDetails: maps fields + 100% completeness", () => {
  const d = parsePlaceDetails(full);
  assert.equal(d.connected, true);
  assert.equal(d.demo, false);
  assert.equal(d.rating, 4.8);
  assert.equal(d.reviews_total, 42);
  assert.equal(d.completeness_pct, 100);
  assert.equal(d.reviews.length, 1);
  assert.equal(d.reviews[0].author, "Jane D.");
  assert.equal(d.photos_count, 3);
});

test("parsePlaceDetails: partial profile → fractional completeness", () => {
  const d = parsePlaceDetails({ name: "X", rating: 3.0, user_ratings_total: 2, website: "https://x.com" });
  // only 'website' satisfied of 6 → ~17%
  assert.equal(d.completeness_pct, 17);
  assert.equal(d.reviews.length, 0);
});

test("gbpNotConnected: clean empty state with error", () => {
  const d = gbpNotConnected("No location mapped.");
  assert.equal(d.connected, false);
  assert.equal(d.error, "No location mapped.");
  assert.equal(d.completeness_pct, 0);
});
