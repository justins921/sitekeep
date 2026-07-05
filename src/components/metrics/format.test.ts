import { test } from "node:test";
import assert from "node:assert/strict";
import { deltaDir, deltaTone } from "./format.ts";

test("deltaDir reflects the raw number movement", () => {
  assert.equal(deltaDir(12), "up");
  assert.equal(deltaDir(-12), "down");
  assert.equal(deltaDir(0), "flat");
});

test("deltaTone: higher-is-better (clicks, CTR, users, impressions)", () => {
  assert.equal(deltaTone(9), "good"); // more clicks = good
  assert.equal(deltaTone(-9), "bad"); // fewer clicks = bad
  assert.equal(deltaTone(0), "flat");
});

test("deltaTone: lower-is-better (avg position) — a downward move is GOOD", () => {
  // Position improved from 14 → 11.9 ≈ -15%: lower is better, so GREEN/good.
  assert.equal(deltaTone(-15, true), "good");
  // Position worsened (number went up): bad.
  assert.equal(deltaTone(17, true), "bad");
  assert.equal(deltaTone(0, true), "flat");
});

test("position: arrow follows the number, color follows goodness", () => {
  // Improving position: number went DOWN (arrow) but it's GOOD (green).
  assert.equal(deltaDir(-15), "down");
  assert.equal(deltaTone(-15, true), "good");
});
