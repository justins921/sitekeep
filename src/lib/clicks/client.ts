import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeClicks, type ClicksExtras } from "./normalize";
import type {
  ClicksAuthMode,
  ClicksConnection,
  ClicksRawCompetitors,
  ClicksRawPromptResults,
  ClicksRawReport,
} from "./types";
import type { AiVisibilityResult, AiSource } from "@/lib/ai-visibility/types";

const BASE_URL = "https://app.clicks.so";
const TIMEOUT_MS = 45_000;
const SOURCE: AiSource = { label: "Clicks", variant: "clicks", demo: false };

function fail(reason: Extract<AiVisibilityResult, { ok: false }>["reason"], message: string): AiVisibilityResult {
  return { ok: false, reason, message, source: SOURCE };
}

/** Auth header for a connection: session cookie (pilot) or Bearer token (official). */
function authHeaders(conn: ClicksConnection): Record<string, string> {
  const base = {
    accept: "application/json, text/plain, */*",
    "x-requested-with": "XMLHttpRequest",
  };
  return conn.authMode === "token"
    ? { ...base, authorization: `Bearer ${conn.credential}` }
    : { ...base, cookie: `_search_session=${conn.credential}` };
}

/** Resolve the agency's Clicks connection: DB row first, else the pilot env cookie. */
async function resolveConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
): Promise<ClicksConnection | null> {
  const { data } = await supabase
    .from("agency_clicks_connections")
    .select("auth_mode, credential")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (data?.credential) {
    return { authMode: data.auth_mode as ClicksAuthMode, credential: data.credential };
  }
  const envCookie = process.env.CLICKS_SESSION_COOKIE?.trim();
  if (envCookie) return { authMode: "session", credential: envCookie };
  return null;
}

async function getJson<T>(
  path: string,
  conn: ClicksConnection,
): Promise<{ ok: true; data: T } | { ok: false; expired: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: authHeaders(conn),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    const expired =
      res.status === 401 ||
      res.status === 403 ||
      (res.status >= 300 && res.status < 400) ||
      (!res.ok && ct.includes("text/html")) ||
      (res.ok && !ct.includes("application/json") && ct.includes("text/html"));
    if (!res.ok || !ct.includes("application/json")) {
      return { ok: false, expired, status: res.status };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, expired: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** Map the raw sibling payloads into normalizer extras (permissive parsing). */
function toExtras(
  competitors: ClicksRawCompetitors | null,
  prompts: ClicksRawPromptResults | null,
): ClicksExtras {
  const str = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (typeof o[k] === "string") return o[k] as string;
    return undefined;
  };
  const num = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
    }
    return undefined;
  };
  const bool = (o: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) if (typeof o[k] === "boolean") return o[k] as boolean;
    return undefined;
  };

  return {
    competitors: (competitors?.favorites ?? []).map((c) => ({
      name: str(c, "name", "title", "domain") ?? "—",
      domain: str(c, "domain", "url") ?? null,
      score: num(c, "visibility_score", "score") ?? null,
      cited: bool(c, "cited", "is_cited") ?? null,
    })),
    prompts: (prompts?.prompts ?? []).map((p) => ({
      prompt: str(p, "prompt", "text", "query") ?? "",
      engine: str(p, "engine", "model") ?? null,
      mentioned: bool(p, "mentioned", "cited") ?? false,
      snippet: str(p, "snippet", "answer", "excerpt") ?? null,
    })),
  };
}

/**
 * Fetch + normalize the Clicks AI-visibility report (plus competitors and
 * per-prompt results) into the shared AiVisibility shape. Resolves the client's
 * clicks_project_id and the agency's connection (session cookie or Bearer token)
 * from the DB. Never throws; an invalid/expired credential returns a graceful
 * "reconnect Clicks" state.
 */
export async function getClicksAiVisibility(clientId: string): Promise<AiVisibilityResult> {
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("clicks_project_id, agency_id")
    .eq("id", clientId)
    .maybeSingle();

  const projectId = client?.clicks_project_id;
  if (projectId == null) {
    return fail("not_mapped", "This client isn’t mapped to a Clicks project.");
  }

  const conn = await resolveConnection(supabase, client!.agency_id as string);
  if (!conn) {
    return fail("missing", "Connect Clicks for this agency to see AI-visibility data.");
  }

  // Main report first — its auth result tells us whether the credential is valid.
  const report = await getJson<ClicksRawReport>(`/projects/${projectId}/ai-visibility-report`, conn);
  if (!report.ok) {
    if (report.expired) return fail("expired", "Reconnect Clicks — the saved credential expired or is invalid.");
    return fail("error", `Clicks returned ${report.status}.`);
  }

  // Siblings are best-effort — a failure here just omits competitors/prompts.
  const [competitors, prompts] = await Promise.all([
    getJson<ClicksRawCompetitors>(`/projects/${projectId}/all-favorite-competitiors`, conn),
    getJson<ClicksRawPromptResults>(`/projects/${projectId}/ai-prompt-results`, conn),
  ]);

  const extras = toExtras(
    competitors.ok ? competitors.data : null,
    prompts.ok ? prompts.data : null,
  );

  return { ok: true, data: normalizeClicks(report.data, extras) };
}
