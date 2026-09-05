import type * as Sentry from "@sentry/nextjs";

// Spec: Security §4 — strip phone numbers, emails, names from error payloads,
// shared across the client/server/edge Sentry configs so all three runtimes
// scrub identically.
export function scrubPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
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
