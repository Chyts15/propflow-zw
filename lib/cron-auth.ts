// Authorisation for the Vercel Cron routes in app/api/cron. Vercel sends
// `Authorization: Bearer $CRON_SECRET` when the variable is set on the project.
//
// This fails CLOSED. The routes used to read `if (process.env.CRON_SECRET && header !== ...)`,
// which skips the check entirely when the secret is missing: a deployment that forgot to set it
// left every cron endpoint open, so anyone who found the URL could generate rent, expire trials or
// trigger reminder emails. With no secret configured, every request is refused.

import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCronRequest(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authHeader ?? "");
  // timingSafeEqual needs equal lengths; a length mismatch is already a refusal.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Returns a 401 to send straight back when the request is not allowed, or null when it is. */
export function rejectUnauthorizedCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (isAuthorizedCronRequest(req.headers.get("authorization"), secret)) return null;
  if (!secret) {
    console.error("CRON_SECRET is not set, so a cron request was refused. Set it in the Vercel project's environment variables.");
  }
  return new Response("Unauthorized", { status: 401 });
}
