// Client-safe feature-flag metadata (no server-only imports) so both the /admin
// console (client component) and server code can share variant definitions.

export const AI_VISIBILITY_FLAG = "ai_visibility";

/** Selectable variants per flag. First entry is the conventional "off" state. */
export const FLAG_VARIANTS: Record<string, string[]> = {
  [AI_VISIBILITY_FLAG]: ["off", "standalone", "clicks"],
};

export function variantsFor(flagKey: string): string[] {
  return FLAG_VARIANTS[flagKey] ?? ["off"];
}
