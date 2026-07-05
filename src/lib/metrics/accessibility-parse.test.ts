import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAccessibility,
  severityFromWeight,
  stripMd,
  groupTitle,
  type LhResultLike,
} from "./accessibility-parse.ts";

test("severityFromWeight: buckets by Lighthouse weight", () => {
  assert.equal(severityFromWeight(10), "serious");
  assert.equal(severityFromWeight(7), "serious");
  assert.equal(severityFromWeight(3), "moderate");
  assert.equal(severityFromWeight(6), "moderate");
  assert.equal(severityFromWeight(1), "minor");
  assert.equal(severityFromWeight(0), "minor");
});

test("stripMd: strips links and code, collapses whitespace", () => {
  assert.equal(
    stripMd("See [the docs](https://x.io) and use `alt`."),
    "See the docs and use alt.",
  );
  assert.equal(stripMd("a\n\n  b"), "a b");
});

test("groupTitle: uses categoryGroups title, else humanizes", () => {
  const lhr: LhResultLike = { categoryGroups: { "a11y-color-contrast": { title: "Contrast" } } };
  assert.equal(groupTitle(lhr, "a11y-color-contrast"), "Contrast");
  assert.equal(groupTitle(lhr, "a11y-names-labels"), "Names labels");
  assert.equal(groupTitle(lhr, undefined), "Other");
});

test("parseAccessibility: splits passed/failed, maps WCAG, counts elements", () => {
  const lhr: LhResultLike = {
    categories: {
      accessibility: {
        score: 0.86,
        auditRefs: [
          { id: "color-contrast", weight: 7, group: "a11y-color-contrast" },
          { id: "image-alt", weight: 10, group: "a11y-names-labels" },
          { id: "document-title", weight: 3, group: "a11y-names-labels" },
          { id: "logical-tab-order", weight: 0, group: "a11y-navigation" }, // manual → skip
          { id: "definition-list", weight: 3, group: "a11y-tables-lists" }, // notApplicable → skip
        ],
      },
    },
    categoryGroups: {
      "a11y-color-contrast": { title: "Contrast" },
      "a11y-names-labels": { title: "Names & labels" },
    },
    audits: {
      "color-contrast": {
        title: "Background and foreground colors have sufficient contrast",
        description: "Low-contrast text is hard to read. [Learn more](https://x).",
        score: 0,
        scoreDisplayMode: "binary",
        details: { items: [{ a: 1 }, { a: 2 }, { a: 3 }] },
      },
      "image-alt": {
        title: "Image elements have [alt] attributes",
        description: "Informative elements should have alt text.",
        score: 1,
        scoreDisplayMode: "binary",
        details: { items: [] },
      },
      "document-title": {
        title: "Document has a <title> element",
        description: "A title helps screen-reader users.",
        score: 1,
        scoreDisplayMode: "binary",
      },
      "logical-tab-order": {
        title: "Tab order is logical",
        score: null,
        scoreDisplayMode: "manual",
      },
      "definition-list": {
        title: "Definition lists are well-formed",
        score: null,
        scoreDisplayMode: "notApplicable",
      },
    },
  };

  const out = parseAccessibility(lhr, "mobile");
  assert.equal(out.score, 86);
  assert.equal(out.strategy, "mobile");
  assert.equal(out.failed_count, 1);
  assert.equal(out.passed_count, 2);

  const fail = out.failed[0];
  assert.equal(fail.id, "color-contrast");
  assert.equal(fail.severity, "serious");
  assert.equal(fail.affected, 3);
  assert.equal(fail.group, "Contrast");
  assert.equal(fail.wcag, "WCAG 1.4.3 Contrast (Minimum)");
  assert.ok(!fail.description.includes("["), "markdown stripped from description");

  const ids = out.passed.map((p) => p.id).sort();
  assert.deepEqual(ids, ["document-title", "image-alt"]);
});

test("parseAccessibility: failed sorted by severity then affected", () => {
  const lhr: LhResultLike = {
    categories: {
      accessibility: {
        score: 0.5,
        auditRefs: [
          { id: "minor-a", weight: 1 },
          { id: "serious-few", weight: 8 },
          { id: "serious-many", weight: 8 },
        ],
      },
    },
    audits: {
      "minor-a": { title: "Minor", score: 0, scoreDisplayMode: "binary", details: { items: [{}] } },
      "serious-few": { title: "Serious few", score: 0, scoreDisplayMode: "binary", details: { items: [{}] } },
      "serious-many": {
        title: "Serious many",
        score: 0,
        scoreDisplayMode: "binary",
        details: { items: [{}, {}, {}] },
      },
    },
  };
  const out = parseAccessibility(lhr, "desktop");
  assert.deepEqual(
    out.failed.map((f) => f.id),
    ["serious-many", "serious-few", "minor-a"],
  );
});

test("parseAccessibility: null score when category missing", () => {
  const out = parseAccessibility({}, "mobile");
  assert.equal(out.score, null);
  assert.equal(out.failed_count, 0);
  assert.equal(out.passed_count, 0);
});
