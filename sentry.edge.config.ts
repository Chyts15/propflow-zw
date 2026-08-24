import * as Sentry from "@sentry/nextjs";

// Enabled only once SENTRY_DSN is set (see .env.example).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
