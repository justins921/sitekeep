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

test("normalizeClicks: maps categorical score → gauge pct + source label", () => {
  const d = normalizeClicks(sample);
  assert.equal(d.scoreLabel, "poor");
  assert.equal(d.scorePct, 33); // poor→33 (Clicks' own mapping)
  assert.equal(d.source.label, "Clicks");
  assert.equal(d.source.variant, "clicks");
  assert.equal(d.source.demo, false);
});

test("normalizeClicks: 5 engines in order, all not-cited for the pilot", () => {
  const d = normalizeClicks(sample);
  assert.deepEqual(
    d.engines.map((m) => m.key),
    ["chatgpt", "perplexity", "gemini", "ai_overview", "ai_mode"],
  );
  assert.equal(d.citedCount, 0);
  assert.equal(d.engines[0].name, "ChatGPT");
  assert.equal(d.engines[0].statusLabel, "Not cited yet");
});

test("normalizeClicks: lists + impact normalization; empty optional sources", () => {
  const d = normalizeClicks(sample);
  assert.ok(d.holdingBack.length >= 1);
  assert.ok(d.keywordThemes.length >= 1);
  assert.ok(d.keywordThemes[0].keywords.length >= 1);
  assert.ok(d.recommendations.length >= 1);
  assert.ok(["high", "medium", "low", "other"].includes(d.recommendations[0].impact));
  assert.equal(d.processing, false); // status "ready"
  assert.deepEqual(d.competitors, []); // no extras passed
  assert.deepEqual(d.prompts, []);
});

test("normalizeClicks: merges sibling extras (competitors + prompts)", () => {
  const d = normalizeClicks(
    sample,
    {
      competitors: [{ name: "Rival PT", domain: "rivalpt.com", score: 72, cited: true }],
      prompts: [{ prompt: "best PT near me", engine: "perplexity", mentioned: true, snippet: "…Rival PT…" }],
    },
    false,
  );
  assert.equal(d.competitors.length, 1);
  assert.equal(d.competitors[0].name, "Rival PT");
  assert.equal(d.competitors[0].score, 72);
  assert.equal(d.prompts.length, 1);
  assert.equal(d.prompts[0].mentioned, true);
});

test("normalizeClicks: unknown score → null pct, unknown label; demo flag", () => {
  const d = normalizeClicks({ ...sample, visibility_score: "n/a" }, {}, true);
  assert.equal(d.scoreLabel, "unknown");
  assert.equal(d.scorePct, null);
  assert.equal(d.source.demo, true);
});
