import type { ServiceType } from "@/lib/services";

/** Discriminated result every provider returns. Never throws to the caller. */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---- Per-service persisted data shapes (stored in metric_snapshots.data) ----

export type PageSpeedData = {
  strategy: "mobile";
  performance_score: number | null; // 0–100
  lcp_ms: number | null; // Largest Contentful Paint
  cls: number | null; // Cumulative Layout Shift (unitless)
  inp_ms: number | null; // Interaction to Next Paint (field data; may be null)
  fcp_ms: number | null; // First Contentful Paint
  tbt_ms: number | null; // Total Blocking Time
  keyed: boolean; // whether an API key was used
};

export type SecurityGrade = "pass" | "warn" | "fail";

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
};

export type TrafficData = {
  demo: boolean; // true until real GA4 is connected
  range_days: number;
  sessions: number;
  users: number;
  pageviews: number;
  trend_pct: number; // sessions vs the prior period
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

export type ServiceDataMap = {
  page_speed: PageSpeedData;
  traffic: TrafficData;
  security: SecurityData;
  uptime: UptimeData;
};

/** A latest snapshot as read back for rendering. */
export type Snapshot<T extends ServiceType = ServiceType> = {
  service_type: T;
  data: ServiceDataMap[T];
  captured_at: string;
};
