import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGscSiteUrl, gscSourceFor } from "./gsc-util.ts";

test("normalizeGscSiteUrl: URL-prefix keeps protocol/host + trailing slash", () => {
  assert.equal(normalizeGscSiteUrl("https://www.example.com/"), "https://www.example.com/");
  assert.equal(normalizeGscSiteUrl("https://www.example.com"), "https://www.example.com/");
  assert.equal(normalizeGscSiteUrl("http://example.com/blog"), "http://example.com/blog/");
});

test("normalizeGscSiteUrl: domain property", () => {
  assert.equal(normalizeGscSiteUrl("sc-domain:example.com"), "sc-domain:example.com");
  assert.equal(normalizeGscSiteUrl("sc-domain:Example.com"), "sc-domain:example.com");
  // bare domain (no scheme) is treated as a domain property
  assert.equal(normalizeGscSiteUrl("example.com"), "sc-domain:example.com");
});

test("normalizeGscSiteUrl: rejects clearly-invalid input", () => {
  assert.equal(normalizeGscSiteUrl(""), null);
  assert.equal(normalizeGscSiteUrl("   "), null);
  assert.equal(normalizeGscSiteUrl(null), null);
  assert.equal(normalizeGscSiteUrl("not a url"), null);
  assert.equal(normalizeGscSiteUrl("sc-domain:"), null);
});

test("gscSourceFor: real only with credentials AND a usable property", () => {
  assert.equal(gscSourceFor(true, "https://www.example.com/"), "real");
  assert.equal(gscSourceFor(true, "sc-domain:example.com"), "real");
  assert.equal(gscSourceFor(true, null), "empty"); // no property
  assert.equal(gscSourceFor(false, "https://www.example.com/"), "empty"); // no credentials
  assert.equal(gscSourceFor(true, "not a url"), "empty"); // unusable property
});
