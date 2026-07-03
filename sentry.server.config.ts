import * as Sentry from "@sentry/nextjs";

// Server (Node runtime) Sentry init. No-ops entirely when SENTRY_DSN is unset,
// so the app runs identically without an account/key.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
