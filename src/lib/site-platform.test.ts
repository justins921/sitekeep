import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./site-platform.ts";

test("detects Webflow by runtime attrs / generator / header", () => {
  assert.equal(detectPlatform('<html data-wf-page="123" data-wf-site="abc">'), "webflow");
  assert.equal(detectPlatform('<meta content="Webflow" name="generator">'), "webflow");
  assert.equal(detectPlatform("", { server: "Webflow" }), "webflow");
});

test("detects Framer by runtime / generator / header", () => {
  assert.equal(detectPlatform('<meta name="generator" content="Framer">'), "framer");
  assert.equal(detectPlatform('<div data-framer-name="Hero">'), "framer");
  assert.equal(detectPlatform("", { server: "Framer" }), "framer");
});

test("detects WordPress and Shopify", () => {
  assert.equal(detectPlatform('<link href="/wp-content/themes/x/style.css">'), "wordpress");
  assert.equal(detectPlatform('<script src="https://cdn.shopify.com/s/x.js">'), "shopify");
});

test("asset hotlinks are NOT a signal — website-files.com alone is not Webflow", () => {
  // Regression: a site migrated to Vercel that still hotlinks old Webflow images.
  assert.equal(
    detectPlatform('<img src="https://assets-global.website-files.com/x.png">', { server: "Vercel" }),
    "other",
  );
  // framerusercontent.com alone (hotlinked) is likewise not proof of Framer.
  assert.equal(detectPlatform('<img src="https://framerusercontent.com/a.png">'), "other");
});

test("real runtime marker still wins even with old hotlinked assets present", () => {
  assert.equal(
    detectPlatform('<html data-wf-page="1"><img src="https://assets.website-files.com/x.png"></html>'),
    "webflow",
  );
});

test("plain / unknown markup → other", () => {
  assert.equal(detectPlatform("<html><body><h1>Hello</h1></body></html>"), "other");
  assert.equal(detectPlatform(""), "other");
});
