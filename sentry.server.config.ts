import * as Sentry from "@sentry/nextjs";

// Enabled only once SENTRY_DSN is set (see .env.example) — Sentry.init with
// no dsn is inert, so this is safe to import unconditionally.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend: scrubPii,
});

// Spec: Security §4 — strip phone numbers, emails, names from error payloads.
function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete (event.user as Record<string, unknown>).phone;
  }
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
  }
  return event;
}
