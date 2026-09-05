import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "@/lib/sentry-scrub";

// Enabled only once SENTRY_DSN is set (see .env.example) — Sentry.init with
// no dsn is inert, so this is safe to import unconditionally.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: scrubPii,
});
