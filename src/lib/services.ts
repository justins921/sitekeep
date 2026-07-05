// Pure constants + types shared by server and client code. Keep this module
// free of any server-only imports (no next/headers, no supabase server client)
// so Client Components can import it safely.

export const SERVICE_TYPES = [
  "page_speed",
  "traffic",
  "security",
  "uptime",
  "search_console",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_META: Record<
  ServiceType,
  { label: string; blurb: string; tint: "blue" | "violet" | "green" | "pink" }
> = {
  page_speed: {
    label: "Page Speed",
    blurb: "One-click speed checks and Core Web Vitals.",
    tint: "blue",
  },
  traffic: {
    label: "Traffic",
    blurb: "Clear traffic and growth insights.",
    tint: "violet",
  },
  security: {
    label: "Security",
    blurb: "Automated SSL and security-header checks.",
    tint: "green",
  },
  uptime: {
    label: "Uptime",
    blurb: "24/7 uptime monitoring with downtime & SSL alerts.",
    tint: "pink",
  },
  search_console: {
    label: "Search / SEO",
    blurb: "Google Search clicks, impressions, and ranking positions.",
    tint: "violet",
  },
};
