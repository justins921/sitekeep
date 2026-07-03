import * as Sentry from "@sentry/nextjs";

// Loads the per-runtime Sentry config (guarded by SENTRY_DSN inside each) and
// wires Next's request-error hook so thrown errors in server components, route
// handlers, server actions, and the cron/webhook routes are captured.
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
