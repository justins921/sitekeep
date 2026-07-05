import "server-only";
import { getFeature } from "@/lib/features";
import { AI_VISIBILITY_FLAG } from "@/lib/features-meta";
import { getClicksAiVisibility } from "@/lib/clicks/client";
import { runStandaloneAiVisibility } from "./providers/standalone";
import type { AiVisibilityResult } from "./types";

export * from "./types";

/**
 * Resolve AI-visibility for a client through the feature flag: the card renders
 * only when the flag is enabled for the agency, and the SOURCE is chosen by the
 * flag variant ('clicks' | 'standalone'). Returns a discriminated result the
 * unified <AiVisibilityCard> renders directly. Server-side only.
 */
export async function getAiVisibility(
  agencyId: string,
  clientId: string,
): Promise<AiVisibilityResult> {
  const feature = await getFeature(agencyId, AI_VISIBILITY_FLAG);
  if (!feature.enabled) {
    return { ok: false, reason: "disabled", message: "AI Visibility is not enabled." };
  }

  switch (feature.variant) {
    case "clicks":
      return getClicksAiVisibility(clientId);
    case "standalone":
      return runStandaloneAiVisibility(clientId, feature.config);
    default:
      return { ok: false, reason: "disabled", message: "AI Visibility variant is off." };
  }
}
