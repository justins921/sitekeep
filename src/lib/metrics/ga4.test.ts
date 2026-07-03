import { test } from "node:test";
import assert from "node:assert/strict";
import { parseServiceAccount, normalizeGa4PropertyId, ga4SourceFor } from "./ga4.ts";

const SA = {
  client_email: "sitekeep@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
};
const rawJson = JSON.stringify(SA);
const base64 = Buffer.from(rawJson).toString("base64");

test("parseServiceAccount: raw JSON parses and unescapes newlines", () => {
  const sa = parseServiceAccount(rawJson);
  assert.ok(sa);
  assert.equal(sa!.client_email, SA.client_email);
  assert.ok(sa!.private_key.includes("\n"));
  assert.ok(!sa!.private_key.includes("\\n"));
  assert.equal(sa!.token_uri, "https://oauth2.googleapis.com/token");
});

test("parseServiceAccount: base64-encoded JSON parses the same", () => {
  const sa = parseServiceAccount(base64);
  assert.ok(sa);
  assert.equal(sa!.client_email, SA.client_email);
});

test("parseServiceAccount: missing/garbage returns null", () => {
  assert.equal(parseServiceAccount(undefined), null);
  assert.equal(parseServiceAccount(""), null);
  assert.equal(parseServiceAccount("not-valid"), null);
  assert.equal(parseServiceAccount(JSON.stringify({ client_email: "x" })), null); // no key
});

test("normalizeGa4PropertyId: extracts digits or null", () => {
  assert.equal(normalizeGa4PropertyId("123456789"), "123456789");
  assert.equal(normalizeGa4PropertyId("properties/987"), "987");
  assert.equal(normalizeGa4PropertyId("G-ABCDEF"), null); // measurement id → no digits
  assert.equal(normalizeGa4PropertyId(""), null);
  assert.equal(normalizeGa4PropertyId(null), null);
});

test("ga4SourceFor: real only with credentials AND a usable property id", () => {
  assert.equal(ga4SourceFor(true, "123456789"), "real");
  assert.equal(ga4SourceFor(true, "properties/123"), "real");
  assert.equal(ga4SourceFor(true, null), "stub"); // no property
  assert.equal(ga4SourceFor(false, "123456789"), "stub"); // no credentials
  assert.equal(ga4SourceFor(true, "G-ABCDEF"), "stub"); // unusable property
  assert.equal(ga4SourceFor(true, "   "), "stub");
});
