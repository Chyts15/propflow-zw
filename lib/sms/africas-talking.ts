import "server-only";
import AfricasTalking from "africastalking";
import { prisma } from "@/lib/db";

export function isSmsConfigured() {
  return Boolean(process.env.AT_API_KEY && process.env.AT_USERNAME);
}

let client: ReturnType<typeof AfricasTalking> | null = null;
function getClient() {
  if (!isSmsConfigured()) return null;
  client ??= AfricasTalking({
    apiKey: process.env.AT_API_KEY!,
    username: process.env.AT_USERNAME!,
  });
  return client;
}

export const SMS_TEMPLATES = {
  RENT_REMINDER_BEFORE: (amt: string, unit: string, property: string, date: string) =>
    `PropFlow: Rent of $${amt} for Unit ${unit}, ${property} is due ${date}. Pay your landlord & upload proof in the app.`,
  RENT_REMINDER_DUE: (amt: string, unit: string) =>
    `PropFlow: Rent of $${amt} for Unit ${unit} is due today.`,
  RENT_REMINDER_OVERDUE: (amt: string, unit: string, date: string) =>
    `PropFlow: Rent of $${amt} for Unit ${unit} was due ${date}. Please pay & upload proof, or contact your landlord.`,
  COMPLAINT_UPDATE: (shortId: string, status: string) =>
    `PropFlow: Your complaint #${shortId} is now ${status}.`,
  PAYMENT_PROOF_ALERT: (tenant: string, unit: string) =>
    `PropFlow: ${tenant}, Unit ${unit} uploaded payment proof. Review in the app.`,
} as const;

type SmsTemplate = "RENT_REMINDER" | "COMPLAINT_UPDATE" | "PAYMENT_PROOF_ALERT";

type SendSmsArgs = {
  orgId: string;
  recipientUserId: string;
  template: SmsTemplate;
  body: string;
  costUsd?: number;
};

/**
 * The one place SMS actually goes out. smsOptIn is checked HERE, never at
 * call sites (CLAUDE.md § Africa-First Development). Never throws — logs
 * failures to SmsLog instead so a bad send can't 500 a caller's mutation.
 */
export async function sendSms({ orgId, recipientUserId, template, body, costUsd }: SendSmsArgs) {
  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { phone: true, smsOptIn: true },
  });

  if (!recipient?.phone) {
    return logAndReturn({ orgId, recipient: "unknown", template, body, status: "FAILED", costUsd });
  }
  if (!recipient.smsOptIn) {
    return logAndReturn({ orgId, recipient: recipient.phone, template, body, status: "OPTED_OUT", costUsd });
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { smsCredits: true } });
  if (!org || org.smsCredits <= 0) {
    return logAndReturn({ orgId, recipient: recipient.phone, template, body, status: "FAILED", costUsd });
  }

  const sms = getClient();
  try {
    if (sms) {
      await sms.SMS.send({
        to: recipient.phone,
        message: body,
        senderId: process.env.AT_SENDER_ID,
      });
    }
    // sms === null means Africa's Talking isn't configured yet — the log
    // still records intent so the flow is verifiable before real keys exist.
    await prisma.organization.update({ where: { id: orgId }, data: { smsCredits: { decrement: 1 } } });
    return logAndReturn({ orgId, recipient: recipient.phone, template, body, status: "SENT", costUsd });
  } catch {
    return logAndReturn({ orgId, recipient: recipient.phone, template, body, status: "FAILED", costUsd });
  }
}

function logAndReturn(args: {
  orgId: string;
  recipient: string;
  template: SmsTemplate;
  body: string;
  status: "SENT" | "FAILED" | "OPTED_OUT";
  costUsd?: number;
}) {
  return prisma.smsLog.create({
    data: {
      orgId: args.orgId,
      recipient: args.recipient,
      template: args.template,
      body: args.body,
      status: args.status,
      costUsd: args.costUsd,
    },
  });
}
