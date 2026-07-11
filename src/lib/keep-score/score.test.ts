import { test } from "node:test";
import assert from "node:assert/strict";
import { computeKeepScore, weekStatus, KEEP_WEIGHTS } from "./score.ts";
import { normalizeSslDomain, normalizeUptime } from "./normalize.ts";

test("weights sum to 1", () => {
  const sum = Object.values(KEEP_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("all dimensions present: plain weighted average", () => {
  const r = computeKeepScore({ uptime: 100, form: 100, performance: 50, ssl_domain: 100, links: 100 });
  // 0.4*100 + 0.2*100 + 0.2*50 + 0.1*100 + 0.1*100 = 90
  assert.equal(r.score, 90);
  assert.equal(r.measured.length, 5);
});

test("no form → its weight folds into uptime (per spec)", () => {
  const r = computeKeepScore({ uptime: 50, performance: 100, ssl_domain: 100, links: 100 });
  // effective: uptime 0.6, perf 0.2, ssl 0.1, links 0.1 (sum 1)
  // 0.6*50 + 0.2*100 + 0.1*100 + 0.1*100 = 30 + 20 + 10 + 10 = 70
  assert.equal(r.score, 70);
  const uptime = r.contributions.find((c) => c.dimension === "uptime");
  assert.ok(Math.abs((uptime?.weight ?? 0) - 0.6) < 1e-9);
});

test("other missing dimension → weight renormalized across present", () => {
  // only uptime + performance present, no form: form→uptime, then renormalize.
  const r = computeKeepScore({ uptime: 80, performance: 80 });
  assert.equal(r.score, 80); // both 80 → 80 regardless of split
  assert.ok(Math.abs(r.contributions.reduce((s, c) => s + c.weight, 0) - 1) < 1e-9);
});

test("nothing measured → null", () => {
  assert.equal(computeKeepScore({}).score, null);
  assert.equal(computeKeepScore({ uptime: null }).score, null);
});

test("weekStatus thresholds + incident overrides", () => {
  assert.equal(weekStatus(95), "green");
  assert.equal(weekStatus(90), "green");
  assert.equal(weekStatus(89), "amber");
  assert.equal(weekStatus(70), "amber");
  assert.equal(weekStatus(69), "red");
  assert.equal(weekStatus(null), "none");
  assert.equal(weekStatus(98, { resolvedIncident: true }), "amber"); // caught+resolved
  assert.equal(weekStatus(98, { unresolvedIncident: true }), "red"); // still down
});

test("normalizeSslDomain: invalid cert is critical; runway rewarded", () => {
  assert.equal(normalizeSslDomain({ sslValid: false, sslDaysToExpiry: 200, domainDaysToExpiry: 200 }), 0);
  assert.equal(normalizeSslDomain({ sslValid: true, sslDaysToExpiry: 200, domainDaysToExpiry: 200 }), 100);
  // valid cert expiring in 5 days, domain fine: 0.6*60 + 0.4*100 = 76
  assert.equal(normalizeSslDomain({ sslValid: true, sslDaysToExpiry: 5, domainDaysToExpiry: 200 }), 76);
  // domain unknown → just the SSL part
  assert.equal(normalizeSslDomain({ sslValid: true, sslDaysToExpiry: 200, domainDaysToExpiry: null }), 100);
  assert.equal(normalizeSslDomain({ sslValid: null, sslDaysToExpiry: null, domainDaysToExpiry: null }), null);
});

test("normalizeUptime passthrough + null", () => {
  assert.equal(normalizeUptime(99.95), 100);
  assert.equal(normalizeUptime(null), null);
});
