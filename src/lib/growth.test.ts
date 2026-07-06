import { test } from "node:test";
import assert from "node:assert/strict";
import { computeUpsells, type UpsellSignals } from "./growth.ts";

const clean: UpsellSignals = {
  aiEnabled: true,
  aiCited: 5,
  aiEngines: 5,
  aiScoreLabel: "great",
  gbpConnected: true,
  gbpCompleteness: 100,
  gbpRating: 4.8,
  gbpReviews: 120,
  gscConnected: true,
  gscPosition: 4,
  healthScore: 95,
};

test("no nudges when everything is healthy", () => {
  assert.deepEqual(computeUpsells(clean), []);
});

test("Clicks nudge when AI citation coverage is low", () => {
  const n = computeUpsells({ ...clean, aiCited: 1, aiEngines: 5 });
  assert.ok(n.some((x) => x.key === "clicks" && /1 of 5/.test(x.reason)));
});

test("Clicks nudge (proxy) when AI is off but SEO/GBP is weak", () => {
  const n = computeUpsells({
    ...clean,
    aiEnabled: false,
    aiCited: null,
    aiEngines: null,
    aiScoreLabel: null,
    gscPosition: 35, // SEO gap
  });
  assert.ok(n.some((x) => x.key === "clicks"));
  assert.ok(n.some((x) => x.key === "semflow"));
});

test("Semflow nudge on poor average position", () => {
  const n = computeUpsells({ ...clean, gscPosition: 28 });
  assert.ok(n.some((x) => x.key === "semflow" && /28/.test(x.reason)));
});

test("Semflow nudge on incomplete GBP", () => {
  const n = computeUpsells({ ...clean, gbpCompleteness: 50 });
  assert.ok(n.some((x) => x.key === "semflow" && /50%/.test(x.reason)));
});

test("healthy AI but weak GBP → only Semflow, not Clicks", () => {
  const n = computeUpsells({ ...clean, gbpReviews: 3 });
  assert.ok(n.some((x) => x.key === "semflow"));
  assert.ok(!n.some((x) => x.key === "clicks")); // AI is healthy → no Clicks nudge
});

test("no GSC/GBP connection → those gaps don't fire", () => {
  const n = computeUpsells({
    ...clean,
    aiEnabled: false,
    aiCited: null,
    aiEngines: null,
    aiScoreLabel: null,
    gbpConnected: false,
    gscConnected: false,
    healthScore: 90,
  });
  assert.deepEqual(n, []);
});
