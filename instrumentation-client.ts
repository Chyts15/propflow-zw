import * as Sentry from "@sentry/nextjs";

// Client-side reporting needs a browser-exposed DSN. The spec's .env.example
// only lists a server-side SENTRY_DSN; add NEXT_PUBLIC_SENTRY_DSN later if
// client-side error capture is wanted too. Sentry.init with no dsn is inert.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
