import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "@/lib/sentry-scrub";

// Client-side Sentry init — Turbopack requires this file (sentry.client.config.ts
// is deprecated under Turbopack). Enabled only once NEXT_PUBLIC_SENTRY_DSN is
// set (see .env.example); Sentry.init with no dsn is inert.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: scrubPii,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
