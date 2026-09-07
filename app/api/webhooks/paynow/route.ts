import * as Sentry from "@sentry/nextjs";
import {
  getBillingEventByRef,
  finalizeBillingEvent,
  activateOrgFromBillingEvent,
  getOrganization,
  getBillingRecipientsForOrg,
} from "@/lib/db/scoped";
import { verifyAndPollWebhook } from "@/lib/payments/paynow";
import { claimIdempotencyKey } from "@/lib/rate-limit";
import { sendBillingEmail } from "@/lib/email/resend";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import { TIER_LABELS } from "@/lib/tier";

// Only the subscription-renewal flow gets billing emails — an SMS-bundle top-up
// isn't part of the renewal-lapse domain this webhook otherwise documents.
//
// PAID sends a receipt. FAILED/CANCELLED sends a "please retry" notice, NOT
// the cron's RENEWAL_LAPSED — a single failed Paynow attempt doesn't mean the
// org is past due (currentPeriodEnd may still be days away); only the
// renewal-lapse cron (app/api/cron/renewal-lapse) knows that for certain.
async function notifyBillingEvent(
  orgId: string,
  event: { type: string; amountUsd: number; paynowRef: string | null },
  outcome: "PAID" | "FAILED",
) {
  if (event.type !== "SUBSCRIPTION_PAYMENT") return;
  const org = await getOrganization(orgId);
  const recipients = await getBillingRecipientsForOrg(orgId);
  if (recipients.length === 0) return;

  const template =
    outcome === "PAID"
      ? EMAIL_TEMPLATES.PAYMENT_RECEIPT(
          org.name,
          TIER_LABELS[org.tier],
          event.amountUsd,
          org.currentPeriodEnd!,
          event.paynowRef ?? "—",
        )
      : EMAIL_TEMPLATES.PAYMENT_FAILED(org.name);

  await Promise.all(
    recipients.map((to) =>
      sendBillingEmail({
        orgId,
        to,
        template: outcome === "PAID" ? "PAYMENT_RECEIPT" : "PAYMENT_FAILED",
        subject: template.subject,
        html: template.html,
      }),
    ),
  );
}

// Paynow POSTs the result as application/x-www-form-urlencoded — the
// `paynow` SDK's parseQuery/verifyHash expect that exact query-string shape,
// so this reads the raw body rather than parsing JSON.
//
// Hardening (spec: Security §2, CLAUDE.md § Security First):
//   1. Verify hash on the raw callback
//   2. RE-POLL Paynow's own status endpoint — never trust the payload amount
//      (moot here anyway: we set the price ourselves at initiate, the payload
//      never carries a customer-controlled amount)
//   3. Idempotency: BillingEvent.paynowRef unique + PENDING-status guard is
//      authoritative; Redis is just a fast-path to skip a redundant re-poll
export async function POST(req: Request) {
  const raw = await req.text();
  const payload = Object.fromEntries(new URLSearchParams(raw));
  const reference = payload.reference;
  if (!reference) return new Response("Missing reference", { status: 400 });

  const event = await getBillingEventByRef(reference);
  if (!event || event.status !== "PENDING" || !event.pollUrl) {
    // Unknown reference, or already finalized by an earlier delivery of this
    // same webhook — ack so Paynow stops retrying, do nothing else.
    return new Response("OK", { status: 200 });
  }

  const claimed = await claimIdempotencyKey(`paynow-webhook:${reference}`);
  if (!claimed) return new Response("OK", { status: 200 });

  let statusResponse;
  try {
    statusResponse = await verifyAndPollWebhook(payload, event.pollUrl);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "paynow-webhook" }, extra: { reference } });
    return new Response("Invalid", { status: 400 });
  }

  const status = statusResponse?.status?.toString().toLowerCase();
  if (status === "paid") {
    const finalized = await finalizeBillingEvent(event.id, "PAID");
    if (finalized) {
      await activateOrgFromBillingEvent(event.orgId, event);
      await notifyBillingEvent(event.orgId, event, "PAID");
    }
  } else if (status === "cancelled" || status === "failed" || status === "disputed") {
    const finalized = await finalizeBillingEvent(event.id, status === "cancelled" ? "CANCELLED" : "FAILED");
    if (finalized) await notifyBillingEvent(event.orgId, event, "FAILED");
  }
  // Any other status (created/sent/awaiting delivery) — leave PENDING; a
  // later callback will resolve it.

  return new Response("OK", { status: 200 });
}
