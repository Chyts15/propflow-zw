import { expireOverdueTrials, getBillingRecipientsForOrg } from "@/lib/db/scoped";
import { sendBillingEmailBatch } from "@/lib/email/resend";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";

// Vercel Cron, daily (see vercel.json). Flips expired unpaid trials to
// PAST_DUE — landlordWriteProcedure (lib/trpc.ts) is what actually enforces
// the 7-day-grace-then-read-only rule; this route never deletes data.
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const orgs = await expireOverdueTrials();

  const emails = await Promise.all(
    orgs.map(async (org) => {
      const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { subject, html } = EMAIL_TEMPLATES.TRIAL_EXPIRED(org.name, graceEndsAt);
      const recipients = await getBillingRecipientsForOrg(org.id);
      return recipients.map((to) => ({ orgId: org.id, to, template: "TRIAL_EXPIRED" as const, subject, html }));
    }),
  );
  await sendBillingEmailBatch(emails.flat());

  return Response.json({ transitioned: orgs.length });
}
