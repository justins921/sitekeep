import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./site-platform.ts";

test("detects Webflow (data-wf-page + generator + CDN)", () => {
  assert.equal(detectPlatform('<html data-wf-page="123" data-wf-site="abc">'), "webflow");
  assert.equal(detectPlatform('<meta content="Webflow" name="generator">'), "webflow");
  assert.equal(detectPlatform('<img src="https://assets-global.website-files.com/x.png">'), "webflow");
});

test("detects Framer (asset host + generator + attrs)", () => {
  assert.equal(detectPlatform('<img src="https://framerusercontent.com/x.png">'), "framer");
  assert.equal(detectPlatform('<meta name="generator" content="Framer">'), "framer");
  assert.equal(detectPlatform('<div data-framer-name="Hero">'), "framer");
});

test("detects WordPress and Shopify", () => {
  assert.equal(detectPlatform('<link href="/wp-content/themes/x/style.css">'), "wordpress");
  assert.equal(detectPlatform('<script src="https://cdn.shopify.com/s/x.js">'), "shopify");
});

test("Framer wins over other builders when both signatures present (specificity order)", () => {
  // A Framer site that also references wp-content in some third-party embed.
  assert.equal(
    detectPlatform('<html><img src="https://framerusercontent.com/a.png"><link href="/wp-content/x.css"></html>'),
    "framer",
  );
});

test("plain / unknown markup → other", () => {
  assert.equal(detectPlatform("<html><body><h1>Hello</h1></body></html>"), "other");
  assert.equal(detectPlatform(""), "other");
});
