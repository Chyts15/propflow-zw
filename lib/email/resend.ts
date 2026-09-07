import "server-only";
import { Resend } from "resend";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";

// Billing-notification fallback. CLAUDE.md § Africa-First Development says
// SMS is primary, but billing email is a deliberate exception: a PAST_DUE org
// can have zero smsCredits, and sendSms hard-fails with no credits — exactly
// the moment a landlord most needs to hear about it. Email is the reliable
// channel here.

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;
function getClient() {
  if (!isEmailConfigured()) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

const SEND_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const signal = AbortSignal.timeout(ms);
    signal.addEventListener("abort", () => reject(new Error("Email send timed out")));
    promise.then(resolve, reject);
  });
}

export type EmailSendResult = { status: "SENT" | "SKIPPED" | "FAILED" };

/**
 * The one place transactional email actually goes out. Never throws — mirrors
 * sendSms's never-throw contract (lib/sms/africas-talking.ts) so a bad send
 * can't 500 a caller's mutation.
 */
export async function sendTransactionalEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${args.to}: ${args.subject}`);
    return { status: "SKIPPED" };
  }

  try {
    const { error } = await withTimeout(
      resend.emails.send({
        from: process.env.RESEND_FROM ?? "notifications@propflow.co.zw",
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
      SEND_TIMEOUT_MS,
    );
    if (error) {
      Sentry.captureException(new Error(error.message), {
        tags: { area: "email" },
        extra: { to: args.to, subject: args.subject },
      });
      return { status: "FAILED" };
    }
    return { status: "SENT" };
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "email" }, extra: { to: args.to, subject: args.subject } });
    return { status: "FAILED" };
  }
}

type EmailTemplate =
  | "TRIAL_EXPIRING_SOON"
  | "TRIAL_EXPIRED"
  | "RENEWAL_UPCOMING"
  | "RENEWAL_LAPSED"
  | "PAYMENT_FAILED"
  | "PAYMENT_RECEIPT";

/**
 * Sends one billing-notification email and logs it to EmailLog, mirroring
 * sendSms's logAndReturn pattern. Use this (not sendTransactionalEmail
 * directly) for anything billing-related so it stays queryable.
 */
export async function sendBillingEmail(args: {
  orgId: string;
  to: string;
  template: EmailTemplate;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const result = await sendTransactionalEmail({ to: args.to, subject: args.subject, html: args.html });
  await prisma.emailLog.create({
    data: {
      orgId: args.orgId,
      recipient: args.to,
      template: args.template,
      subject: args.subject,
      status: result.status,
    },
  });
  return result;
}

/**
 * Batch variant for cron sweeps (trial/renewal lapse + warnings) — sends via
 * Resend's batch endpoint (one HTTP round-trip for up to 100 emails) instead
 * of a per-org loop of inline sends, which would risk a partial failure under
 * Vercel's function timeout on an org list that's grown large.
 */
const RESEND_BATCH_LIMIT = 100;

export async function sendBillingEmailBatch(
  items: { orgId: string; to: string; template: EmailTemplate; subject: string; html: string }[],
): Promise<void> {
  if (items.length === 0) return;
  if (items.length > RESEND_BATCH_LIMIT) {
    for (let i = 0; i < items.length; i += RESEND_BATCH_LIMIT) {
      await sendBillingEmailBatch(items.slice(i, i + RESEND_BATCH_LIMIT));
    }
    return;
  }

  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping ${items.length} billing email(s)`);
    await prisma.emailLog.createMany({
      data: items.map((item) => ({
        orgId: item.orgId,
        recipient: item.to,
        template: item.template,
        subject: item.subject,
        status: "SKIPPED" as const,
      })),
    });
    return;
  }

  let failedIndices = new Set<number>();
  let totalFailure = false;
  try {
    // batchValidation: "permissive" so one malformed recipient doesn't sink
    // the whole batch — it comes back as a per-index error instead.
    const { data, error } = await withTimeout(
      resend.batch.send(
        items.map((item) => ({
          from: process.env.RESEND_FROM ?? "notifications@propflow.co.zw",
          to: item.to,
          subject: item.subject,
          html: item.html,
        })),
        { batchValidation: "permissive" },
      ),
      SEND_TIMEOUT_MS,
    );
    if (error) {
      Sentry.captureException(new Error(error.message), {
        tags: { area: "email" },
        extra: { count: items.length },
      });
      totalFailure = true;
    } else {
      failedIndices = new Set(data?.errors?.map((e) => e.index) ?? []);
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "email" }, extra: { count: items.length } });
    totalFailure = true;
  }

  await prisma.emailLog.createMany({
    data: items.map((item, i) => ({
      orgId: item.orgId,
      recipient: item.to,
      template: item.template,
      subject: item.subject,
      status: totalFailure || failedIndices.has(i) ? ("FAILED" as const) : ("SENT" as const),
    })),
  });
}
