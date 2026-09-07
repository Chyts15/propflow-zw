import { expireLapsedSubscriptions, getBillingRecipientsForOrg } from "@/lib/db/scoped";
import { sendBillingEmailBatch } from "@/lib/email/resend";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";

// Vercel Cron, daily (see vercel.json). Flips ACTIVE subscriptions whose
// currentPeriodEnd has passed without a confirmed Paynow renewal to
// PAST_DUE — the webhook (app/api/webhooks/paynow/route.ts) handles the
// happy path when Paynow does call back; this is the safety net for silent
// non-renewal (card/EcoCash never attempted, callback lost, etc).
// landlordWriteProcedure (lib/trpc.ts) enforces the 7-day-grace-then-read-only
// rule; this route never deletes data.
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const orgs = await expireLapsedSubscriptions();

  const emails = await Promise.all(
    orgs.map(async (org) => {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { subject, html } = EMAIL_TEMPLATES.RENEWAL_LAPSED(org.name, graceEndsAt);
      const recipients = await getBillingRecipientsForOrg(org.id);
      return recipients.map((to) => ({ orgId: org.id, to, template: "RENEWAL_LAPSED" as const, subject, html }));
    }),
  );
  await sendBillingEmailBatch(emails.flat());

  return Response.json({ transitioned: orgs.length });
}
