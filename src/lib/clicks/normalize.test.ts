import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeClicks, isCited } from "./normalize.ts";
import type { ClicksRawReport } from "./types.ts";

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__sample.json", import.meta.url)), "utf8"),
) as ClicksRawReport;

test("isCited: not_cited_yet / none are not cited; anything else is", () => {
  assert.equal(isCited("not_cited_yet"), false);
  assert.equal(isCited("none"), false);
  assert.equal(isCited(""), false);
  assert.equal(isCited("cited"), true);
  assert.equal(isCited("mentioned"), true);
});

test("normalizeClicks: maps categorical score → gauge pct", () => {
  const d = normalizeClicks(sample);
  assert.equal(d.scoreLabel, "poor");
  assert.equal(d.scorePct, 33); // poor→33 (Clicks' own mapping)
});

test("normalizeClicks: 5 models in order, all not-cited for the pilot", () => {
  const d = normalizeClicks(sample);
  assert.deepEqual(
    d.models.map((m) => m.key),
    ["chatgpt", "perplexity", "gemini", "ai_overview", "ai_mode"],
  );
  assert.equal(d.citedCount, 0);
  assert.equal(d.models[0].name, "ChatGPT");
  assert.equal(d.models[0].statusLabel, "Not cited yet");
});

test("normalizeClicks: lists + impact normalization", () => {
  const d = normalizeClicks(sample);
  assert.ok(d.holdingBack.length >= 1);
  assert.ok(d.keywordThemes.length >= 1);
  assert.ok(d.keywordThemes[0].keywords.length >= 1);
  assert.ok(d.recommendations.length >= 1);
  assert.ok(["high", "medium", "low", "other"].includes(d.recommendations[0].impact));
  assert.equal(d.processing, false); // status "ready"
});

test("normalizeClicks: unknown score → null pct, unknown label", () => {
  const d = normalizeClicks({ ...sample, visibility_score: "n/a" });
  assert.equal(d.scoreLabel, "unknown");
  assert.equal(d.scorePct, null);
});
