import "server-only";
import { normalizeClicks } from "./normalize";
import { clicksProjectFor } from "./config";
import type { ClicksRawReport } from "./types";
import type { AiVisibilityResult, AiSource } from "@/lib/ai-visibility/types";

const BASE_URL = "https://app.clicks.so";
const TIMEOUT_MS = 45_000;
const SOURCE: AiSource = { label: "Clicks", variant: "clicks", demo: false };

/**
 * Fetch + normalize the Clicks AI-visibility report for a SiteKeep client into
 * the shared AiVisibility shape. POC auth: a throwaway `_search_session` cookie
 * from CLICKS_SESSION_COOKIE (Phase D productizes this into per-agency creds).
 * Never throws — returns a discriminated result so the card can render a clean
 * "session expired / not mapped / error" state.
 */
export async function getClicksAiVisibility(clientId: string): Promise<AiVisibilityResult> {
  const projectId = clicksProjectFor(clientId);
  if (projectId == null) {
    return {
      ok: false,
      reason: "not_mapped",
      message: "This client isn’t mapped to a Clicks project.",
      source: SOURCE,
    };
  }

  const cookie = process.env.CLICKS_SESSION_COOKIE?.trim();
  if (!cookie) {
    return { ok: false, reason: "missing", message: "No Clicks session cookie configured.", source: SOURCE };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/projects/${projectId}/ai-visibility-report`, {
      headers: {
        accept: "application/json, text/plain, */*",
        "x-requested-with": "XMLHttpRequest",
        cookie: `_search_session=${cookie}`,
      },
      redirect: "manual", // a redirect = the session bounced to login
      cache: "no-store",
      signal: controller.signal,
    });

    const ct = res.headers.get("content-type") ?? "";
    if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) {
      return { ok: false, reason: "expired", message: "Clicks session expired — paste a fresh cookie.", source: SOURCE };
    }
    if (!res.ok || !ct.includes("application/json")) {
      if (ct.includes("text/html")) {
        return { ok: false, reason: "expired", message: "Clicks session expired — paste a fresh cookie.", source: SOURCE };
      }
      return { ok: false, reason: "error", message: `Clicks returned ${res.status}.`, source: SOURCE };
    }

    const raw = (await res.json()) as ClicksRawReport;
    return { ok: true, data: normalizeClicks(raw) };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "error", message: "Clicks timed out.", source: SOURCE };
    }
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Clicks request failed.",
      source: SOURCE,
    };
  } finally {
    clearTimeout(timer);
  }
}
