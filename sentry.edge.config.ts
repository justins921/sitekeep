import * as Sentry from "@sentry/nextjs";

// Edge runtime (proxy/middleware) Sentry init. No-ops without SENTRY_DSN.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
