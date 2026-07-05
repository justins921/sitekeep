// Pure parser that turns a Lighthouse accessibility category into a passed/failed
// audit list. Import-light (only type-only imports) so it can be unit-tested with
// node --test against a captured PSI response — no bundler, no network.
import type { A11yAudit, A11ySeverity, AccessibilityData } from "./types";

type LhAuditLike = {
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  details?: { items?: unknown[] };
};
type LhAuditRefLike = { id: string; weight: number; group?: string };
export type LhResultLike = {
  categories?: Record<string, { score?: number | null; auditRefs?: LhAuditRefLike[] }>;
  categoryGroups?: Record<string, { title?: string }>;
  audits?: Record<string, LhAuditLike>;
};

// Curated Lighthouse-audit → WCAG success-criterion map for the common checks.
// Anything not listed falls back to its Lighthouse group in the UI.
export const WCAG_MAP: Record<string, string> = {
  "color-contrast": "WCAG 1.4.3 Contrast (Minimum)",
  "image-alt": "WCAG 1.1.1 Non-text Content",
  "input-image-alt": "WCAG 1.1.1 Non-text Content",
  "object-alt": "WCAG 1.1.1 Non-text Content",
  "video-caption": "WCAG 1.2.2 Captions",
  label: "WCAG 1.3.1 / 4.1.2",
  "link-name": "WCAG 2.4.4 / 4.1.2",
  "button-name": "WCAG 4.1.2 Name, Role, Value",
  "select-name": "WCAG 4.1.2 Name, Role, Value",
  "document-title": "WCAG 2.4.2 Page Titled",
  "html-has-lang": "WCAG 3.1.1 Language of Page",
  "html-lang-valid": "WCAG 3.1.1 Language of Page",
  "valid-lang": "WCAG 3.1.2 Language of Parts",
  "meta-viewport": "WCAG 1.4.4 Resize Text",
  list: "WCAG 1.3.1 Info and Relationships",
  listitem: "WCAG 1.3.1 Info and Relationships",
  "definition-list": "WCAG 1.3.1 Info and Relationships",
  dlitem: "WCAG 1.3.1 Info and Relationships",
  "th-has-data-cells": "WCAG 1.3.1 Info and Relationships",
  "td-headers-attr": "WCAG 1.3.1 Info and Relationships",
  "heading-order": "WCAG 1.3.1 (best practice)",
  "frame-title": "WCAG 2.4.1 / 4.1.2",
  bypass: "WCAG 2.4.1 Bypass Blocks",
  tabindex: "WCAG 2.4.3 Focus Order",
  "duplicate-id-aria": "WCAG 4.1.1 Parsing",
  "aria-required-attr": "WCAG 4.1.2 Name, Role, Value",
  "aria-required-children": "WCAG 1.3.1 Info and Relationships",
  "aria-required-parent": "WCAG 1.3.1 Info and Relationships",
  "aria-roles": "WCAG 4.1.2 Name, Role, Value",
  "aria-valid-attr": "WCAG 4.1.2 Name, Role, Value",
  "aria-valid-attr-value": "WCAG 4.1.2 Name, Role, Value",
  "aria-allowed-attr": "WCAG 4.1.2 Name, Role, Value",
  "aria-hidden-body": "WCAG 4.1.2 Name, Role, Value",
  "aria-hidden-focus": "WCAG 4.1.2 Name, Role, Value",
  "aria-input-field-name": "WCAG 4.1.2 Name, Role, Value",
  "aria-command-name": "WCAG 4.1.2 Name, Role, Value",
  "aria-toggle-field-name": "WCAG 4.1.2 Name, Role, Value",
  "aria-tooltip-name": "WCAG 4.1.2 Name, Role, Value",
};

/** Strip Lighthouse markdown ([text](url) → text, `code` → code) to plain prose. */
export function stripMd(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Derive a severity hint from the Lighthouse audit weight. */
export function severityFromWeight(weight: number): A11ySeverity {
  if (weight >= 7) return "serious";
  if (weight >= 3) return "moderate";
  return "minor";
}

function humanizeGroup(id: string | undefined): string {
  if (!id) return "Other";
  const t = id.replace(/^a11y-/, "").replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function groupTitle(lhr: LhResultLike, groupId: string | undefined): string {
  if (groupId && lhr.categoryGroups?.[groupId]?.title) return lhr.categoryGroups[groupId]!.title!;
  return humanizeGroup(groupId);
}

const SEV_ORDER: Record<A11ySeverity, number> = { serious: 0, moderate: 1, minor: 2 };

/**
 * Parse the Lighthouse accessibility category into overall score + passed/failed
 * audits. Skips manual / informative / not-applicable audits (not pass/fail).
 */
export function parseAccessibility(
  lhr: LhResultLike,
  strategy: "mobile" | "desktop",
): AccessibilityData {
  const acc = lhr.categories?.accessibility;
  const score = acc?.score == null ? null : Math.round(acc.score * 100);
  const refs = acc?.auditRefs ?? [];
  const audits = lhr.audits ?? {};

  const failed: A11yAudit[] = [];
  const passed: A11yAudit[] = [];

  for (const ref of refs) {
    const a = audits[ref.id];
    if (!a) continue;
    const mode = a.scoreDisplayMode;
    if (mode === "manual" || mode === "informative" || mode === "notApplicable") continue;
    if (typeof a.score !== "number") continue;

    const item: A11yAudit = {
      id: ref.id,
      title: a.title ?? ref.id,
      description: stripMd(a.description ?? ""),
      group: groupTitle(lhr, ref.group),
      wcag: WCAG_MAP[ref.id] ?? null,
      severity: severityFromWeight(ref.weight),
      affected: Array.isArray(a.details?.items) ? a.details!.items!.length : 0,
    };
    if (a.score >= 1) passed.push(item);
    else failed.push(item);
  }

  failed.sort(
    (x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity] || y.affected - x.affected,
  );

  return {
    score,
    strategy,
    passed_count: passed.length,
    failed_count: failed.length,
    failed,
    passed,
  };
}
