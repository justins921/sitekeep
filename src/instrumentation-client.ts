import * as Sentry from "@sentry/nextjs";

// Client-side Sentry. No-ops when NEXT_PUBLIC_SENTRY_DSN is unset.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

// Instruments client-side navigations (no-ops when Sentry isn't initialized).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
