import { getUnpaidRentRecordsForReminders } from "@/lib/db/scoped";
import { sendBillingEmailBatch, wasEmailSentToday, type EmailTemplate } from "@/lib/email/resend";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";

// Vercel Cron, daily (see vercel.json). Mirrors SMS_TEMPLATES' three rent-
// reminder variants (lib/sms/africas-talking.ts) as email, since nothing
// currently tells a tenant to pay at all — sendSms has zero call sites in
// this app. Sent unconditionally: there's no tenant profile page and no
// emailOptIn field (only User.smsOptIn exists) to gate on. This is a
// deliberate, flagged choice, not a silent default — see the PR/commit
// message.
//
// No due-date field exists on RentRecord — the due date is derived from
// (periodMonth/periodYear, Tenancy.rentDueDay) inside
// getUnpaidRentRecordsForReminders, which explains why that's reliable.
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const records = await getUnpaidRentRecordsForReminders();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const emails: { orgId: string; to: string; template: EmailTemplate; subject: string; html: string }[] = [];

  for (const r of records) {
    const dueDate = new Date(r.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    // Each fires exactly once per period, on a single calendar day derived
    // from the due date — not a repeating overdue nag. See scoped.ts's
    // wasEmailSentToday for why this needs no stored "already sent" marker.
    let template: EmailTemplate | null = null;
    if (daysUntilDue === 3) template = "RENT_REMINDER_BEFORE";
    else if (daysUntilDue === 0) template = "RENT_REMINDER_DUE";
    else if (daysUntilDue === -1) template = "RENT_REMINDER_OVERDUE";
    if (!template) continue;

    if (await wasEmailSentToday(r.orgId, r.tenantEmail, template)) continue;

    const { subject, html } =
      template === "RENT_REMINDER_BEFORE"
        ? EMAIL_TEMPLATES.RENT_REMINDER_BEFORE(r.tenantName, r.unitNumber, r.propertyName, r.amountDueUsd, dueDate)
        : template === "RENT_REMINDER_DUE"
          ? EMAIL_TEMPLATES.RENT_REMINDER_DUE(r.tenantName, r.unitNumber, r.amountDueUsd)
          : EMAIL_TEMPLATES.RENT_REMINDER_OVERDUE(r.tenantName, r.unitNumber, r.amountDueUsd, dueDate);

    emails.push({ orgId: r.orgId, to: r.tenantEmail, template, subject, html });
  }

  await sendBillingEmailBatch(emails);
  return Response.json({ candidates: records.length, sent: emails.length });
}
