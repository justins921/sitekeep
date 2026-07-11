import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak, incidentFreeDays, type WeekPoint } from "./streak.ts";

const wk = (status: WeekPoint["status"]): WeekPoint => ({ weekStart: "2026-01-01", status, score: 90 });

test("chain continues through amber, only red breaks it", () => {
  const s = computeStreak([wk("green"), wk("amber"), wk("green"), wk("amber"), wk("green")]);
  assert.equal(s.chainWeeks, 5);
});

test("red breaks the chain; previous best preserved", () => {
  const s = computeStreak([wk("green"), wk("green"), wk("green"), wk("red"), wk("green")]);
  assert.equal(s.chainWeeks, 1); // only the trailing green
  assert.equal(s.previousBest, 3); // the run before the red
  assert.equal(s.brokeRecently, false); // last week is green, not red
});

test("brokeRecently when the newest week is red", () => {
  const s = computeStreak([wk("green"), wk("green"), wk("red")]);
  assert.equal(s.chainWeeks, 0);
  assert.equal(s.previousBest, 2);
  assert.equal(s.brokeRecently, true);
});

test("no-data week breaks the chain", () => {
  const s = computeStreak([wk("green"), wk("none"), wk("green"), wk("green")]);
  assert.equal(s.chainWeeks, 2);
});

test("empty history", () => {
  const s = computeStreak([]);
  assert.deepEqual(s, { chainWeeks: 0, previousBest: 0, brokeRecently: false });
});

test("incidentFreeDays", () => {
  const now = new Date("2026-02-01T00:00:00Z");
  assert.equal(incidentFreeDays("2026-01-15T00:00:00Z", now), 17);
  assert.equal(incidentFreeDays(null, now), null);
});
