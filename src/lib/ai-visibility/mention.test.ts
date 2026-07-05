import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMention, brandTermsFor } from "./mention.ts";
import { estimateRunCost, estimateMonthlyCost, PROMPT_CAP } from "./cost.ts";

test("brandTermsFor: name, significant-words, and domain label", () => {
  const terms = brandTermsFor(
    "Fox Valley Physical Therapy & Wellness Clinic",
    "https://www.foxvalleyphysicaltherapy.com",
  );
  assert.ok(terms.includes("fox valley physical therapy & wellness clinic"));
  assert.ok(terms.includes("foxvalleyphysicaltherapy")); // domain label
  // significant-words variant drops generic suffixes (wellness/clinic/and)
  assert.ok(terms.some((t) => t === "fox valley physical therapy"));
});

test("detectMention: finds brand by name and returns a snippet", () => {
  const text =
    "For physical therapy in the area, top options include Fox Valley Physical Therapy, which has strong reviews.";
  const r = detectMention(text, brandTermsFor("Fox Valley Physical Therapy", "https://foxvalleyphysicaltherapy.com"));
  assert.equal(r.mentioned, true);
  assert.ok(r.snippet && r.snippet.toLowerCase().includes("fox valley"));
});

test("detectMention: matches by domain label even without full name", () => {
  const text = "See foxvalleyphysicaltherapy.com for details.";
  const r = detectMention(text, brandTermsFor("Fox Valley PT", "https://foxvalleyphysicaltherapy.com"));
  assert.equal(r.mentioned, true);
});

test("detectMention: no false positive when absent", () => {
  const text = "The best clinics are Rivertown Rehab and Summit Sports Medicine.";
  const r = detectMention(text, brandTermsFor("Fox Valley Physical Therapy", "https://foxvalleyphysicaltherapy.com"));
  assert.equal(r.mentioned, false);
  assert.equal(r.snippet, null);
});

test("detectMention: punctuation/casing tolerant", () => {
  const text = "FOX-VALLEY  PHYSICAL, THERAPY is well regarded.";
  const r = detectMention(text, ["Fox Valley Physical Therapy"]);
  assert.equal(r.mentioned, true);
});

test("detectMention: empty inputs are safe", () => {
  assert.deepEqual(detectMention("", ["x"]), { mentioned: false, snippet: null });
  assert.deepEqual(detectMention("hello", []), { mentioned: false, snippet: null });
});

test("estimateRunCost: caps prompt count and doubles for extra models", () => {
  const five = estimateRunCost(5);
  assert.ok(five > 0);
  assert.equal(estimateRunCost(5, true), Math.round(five * 2 * 10000) / 10000);
  // above the cap is clamped
  assert.equal(estimateRunCost(50), estimateRunCost(PROMPT_CAP));
});

test("estimateMonthlyCost: weekly ~ 4x monthly", () => {
  const monthly = estimateMonthlyCost({ promptCount: 5, cadence: "monthly" });
  const weekly = estimateMonthlyCost({ promptCount: 5, cadence: "weekly" });
  assert.equal(weekly, Math.round(monthly * 4 * 10000) / 10000);
});
