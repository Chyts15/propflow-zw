import { getBillingEventByRef, finalizeBillingEvent, activateOrgFromBillingEvent } from "@/lib/db/scoped";
import { verifyAndPollWebhook } from "@/lib/payments/paynow";
import { claimIdempotencyKey } from "@/lib/rate-limit";

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
    console.error("Paynow webhook rejected — hash mismatch or poll failure", err);
    return new Response("Invalid", { status: 400 });
  }

  const status = statusResponse?.status?.toString().toLowerCase();
  if (status === "paid") {
    const finalized = await finalizeBillingEvent(event.id, "PAID");
    if (finalized) await activateOrgFromBillingEvent(event.orgId, event);
  } else if (status === "cancelled" || status === "failed" || status === "disputed") {
    await finalizeBillingEvent(event.id, status === "cancelled" ? "CANCELLED" : "FAILED");
  }
  // Any other status (created/sent/awaiting delivery) — leave PENDING; a
  // later callback will resolve it.

  return new Response("OK", { status: 200 });
}
