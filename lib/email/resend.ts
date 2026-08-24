import "server-only";
import { Resend } from "resend";

// Transactional fallback only — SMS is primary (CLAUDE.md § Africa-First Development).

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;
function getClient() {
  if (!isEmailConfigured()) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendTransactionalEmail(args: { to: string; subject: string; html: string }) {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${args.to}: ${args.subject}`);
    return { skipped: true as const };
  }
  return resend.emails.send({
    from: process.env.RESEND_FROM ?? "notifications@propflow.co.zw",
    to: args.to,
    subject: args.subject,
    html: args.html,
  });
}
