import { findAndMarkTrialWarnings, findAndMarkRenewalWarnings, getBillingRecipientsForOrg } from "@/lib/db/scoped";
import { sendBillingEmailBatch } from "@/lib/email/resend";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import { TIER_PRICES } from "@/lib/tier";

// Vercel Cron, daily (see vercel.json). 3-day advance warnings for both
// trial expiry and subscription renewal — separate from the two lapse crons
// so a warning and a lapse transition are never conflated in EmailLog.
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [trialOrgs, renewalOrgs] = await Promise.all([findAndMarkTrialWarnings(), findAndMarkRenewalWarnings()]);

  const trialEmails = await Promise.all(
    trialOrgs.map(async (org) => {
      const { subject, html } = EMAIL_TEMPLATES.TRIAL_EXPIRING_SOON(org.name, org.trialEndsAt);
      const recipients = await getBillingRecipientsForOrg(org.id);
      return recipients.map((to) => ({ orgId: org.id, to, template: "TRIAL_EXPIRING_SOON" as const, subject, html }));
    }),
  );

  const renewalEmails = await Promise.all(
    renewalOrgs.map(async (org) => {
      const monthly = TIER_PRICES[org.tier as "STARTER" | "PRO" | "AGENCY"] ?? 0;
      const amountUsd = org.isAnnual ? monthly * 10 : monthly;
      const { subject, html } = EMAIL_TEMPLATES.RENEWAL_UPCOMING(org.name, org.tier, amountUsd, org.currentPeriodEnd!);
      const recipients = await getBillingRecipientsForOrg(org.id);
      return recipients.map((to) => ({ orgId: org.id, to, template: "RENEWAL_UPCOMING" as const, subject, html }));
    }),
  );

  await sendBillingEmailBatch([...trialEmails.flat(), ...renewalEmails.flat()]);

  return Response.json({ trialWarnings: trialOrgs.length, renewalWarnings: renewalOrgs.length });
}
