// Anonymous scan — shared, client-safe shapes. No server-only imports so the
// onboarding UI can import the types and check keys directly.

import type { KeepDimension } from "@/lib/keep-score/score";

/** One line in the scan breakdown — a Keep Score dimension we could measure. */
export type ScanCheck = {
  dimension: KeepDimension;
  label: string;
  subscore: number | null; // 0–100, null = couldn't measure right now
  status: "good" | "warn" | "bad" | "skipped";
  /** One plain-language line: what we found. */
  detail: string;
  /** Present when status is warn/bad — the one thing worth fixing. */
  insight?: string;
};

export type ScanResult = {
  url: string;
  host: string;
  scannedAt: string; // ISO
  score: number | null; // preview Keep Score, 0–100
  checks: ScanCheck[];
  /** True when the site didn't respond at all (uptime ping failed). */
  unreachable: boolean;
};

/** The order checks animate + render in — matches the Keep Score weights. */
export const SCAN_CHECK_ORDER: KeepDimension[] = [
  "uptime",
  "performance",
  "ssl_domain",
  "links",
];
