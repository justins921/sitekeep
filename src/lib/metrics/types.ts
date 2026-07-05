import type { ServiceType } from "@/lib/services";

/** Discriminated result every provider returns. Never throws to the caller. */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Per-service persisted data shapes (stored in metric_snapshots.data) ----

/** Four Lighthouse category scores, 0–100 (null when unavailable). */
export type LighthouseCategories = {
  performance: number | null;
  accessibility: number | null;
  best_practices: number | null;
  seo: number | null;
};

export type CoreWebVitals = {
  lcp_ms: number | null; // Largest Contentful Paint
  cls: number | null; // Cumulative Layout Shift (unitless)
  inp_ms: number | null; // Interaction to Next Paint (field data; may be null)
  fcp_ms: number | null; // First Contentful Paint
  tbt_ms: number | null; // Total Blocking Time
};

export type PageSpeedStrategyData = {
  categories: LighthouseCategories;
  cwv: CoreWebVitals;
};

export type PageSpeedData = {
  desktop: PageSpeedStrategyData | null;
  mobile: PageSpeedStrategyData | null;
  keyed: boolean; // whether an API key was used
};

export type SecurityGrade = "pass" | "warn" | "fail";
export type SecurityRisk = "minimal" | "low" | "medium" | "high" | "critical";

export type SecurityData = {
  final_url: string;
  https_enforced: boolean;
  ssl_valid: boolean;
  ssl_days_to_expiry: number | null;
  ssl_valid_to: string | null;
  cert_issuer: string | null;
  headers: {
    hsts: boolean;
    csp: boolean;
    x_frame_options: boolean;
    x_content_type_options: boolean;
    referrer_policy: boolean;
  };
  grade: SecurityGrade;
  risk_level: SecurityRisk;
  // Present only when a real Google Safe Browsing lookup ran (SAFE_BROWSING_API_KEY).
  safe_browsing?: { checked: boolean; threats: string[] } | null;
};

/** One metric's current value + preceding-period value + % change. */
export type TrafficDelta = { value: number; prev: number; change_pct: number };
export type TrafficPoint = {
  date: string;
  users: number;
  new_users: number;
  sessions: number;
};

export type TrafficData = {
  demo: boolean; // true until real GA4 is connected
  range_days: number;
  // Headline totals for the current window (kept flat for trends/back-compat).
  sessions: number;
  users: number;
  pageviews: number;
  trend_pct: number; // sessions vs the prior period
  // v2 (real GA4 only):
  new_users?: number;
  engagement_rate?: number; // percent, 0–100
  avg_engagement_time?: number; // seconds
  deltas?: {
    users: TrafficDelta;
    new_users: TrafficDelta;
    engagement_rate: TrafficDelta;
    avg_engagement_time: TrafficDelta;
  };
  daily?: TrafficPoint[]; // current window, per day
  daily_prev?: TrafficPoint[]; // preceding window, per day (for the comparison line)
};

export type UptimeIncidentSummary = {
  type: "downtime" | "ssl_expiring";
  started_at: string;
  resolved_at: string | null;
};

export type UptimeData = {
  status: "up" | "down" | "unknown";
  uptime_pct: number | null; // % up over the rolling window
  window_days: number;
  checks: number; // sample size behind uptime_pct
  avg_response_ms: number | null;
  last_check_at: string | null;
  last_incident: UptimeIncidentSummary | null;
};

/** One Search Console metric's current + preceding-window value + % change. */
export type GscDelta = { value: number; prev: number; change_pct: number };
export type GscQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // percent, 0–100
  position: number; // average position (lower is better)
};
export type GscDayPoint = { date: string; clicks: number; impressions: number };

export type SearchConsoleData = {
  connected: boolean; // false → clean "not connected" empty state
  range_days: number;
  site_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number; // percent, 0–100
  position: number; // average position (lower is better)
  deltas: {
    clicks: GscDelta;
    impressions: GscDelta;
    ctr: GscDelta;
    position: GscDelta;
  };
  top_queries: GscQuery[];
  daily: GscDayPoint[]; // current window, per day
  daily_prev: GscDayPoint[]; // preceding window, per day
};

export type ServiceDataMap = {
  page_speed: PageSpeedData;
  traffic: TrafficData;
  security: SecurityData;
  uptime: UptimeData;
  search_console: SearchConsoleData;
};

/** A latest snapshot as read back for rendering. */
export type Snapshot<T extends ServiceType = ServiceType> = {
  service_type: T;
  data: ServiceDataMap[T];
  captured_at: string;
};
