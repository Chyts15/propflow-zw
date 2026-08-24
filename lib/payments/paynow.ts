import "server-only";
import { Paynow } from "paynow";

// Phase 1 handles PropFlow's own subscription/SMS-bundle billing ONLY.
// No Stripe, no Flutterwave, no tenant-initiated rent payments (Phase 2+).

export function isPaynowConfigured() {
  return Boolean(process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY);
}

function getClient() {
  if (!isPaynowConfigured()) {
    throw new Error(
      "Paynow is not configured — set PAYNOW_INTEGRATION_ID/PAYNOW_INTEGRATION_KEY in .env",
    );
  }
  const paynow = new Paynow(
    process.env.PAYNOW_INTEGRATION_ID,
    process.env.PAYNOW_INTEGRATION_KEY,
  );
  paynow.resultUrl = process.env.PAYNOW_RESULT_URL ?? "";
  paynow.returnUrl = process.env.PAYNOW_RETURN_URL ?? "";
  return paynow;
}

export type SubscriptionCharge = {
  /** BillingEvent.paynowRef — the idempotency anchor (spec: Security §2/§3) */
  reference: string;
  description: string;
  amountUsd: number;
  authEmail: string;
};

/** Redirect-flow subscription payment (web checkout). */
export async function initiateSubscriptionPayment(charge: SubscriptionCharge) {
  const paynow = getClient();
  const payment = paynow.createPayment(charge.reference, charge.authEmail);
  payment.add(charge.description, charge.amountUsd);
  return paynow.send(payment);
}

/** Express (EcoCash/OneMoney) mobile checkout — USSD push to the landlord's phone. */
export async function initiateMobileSubscriptionPayment(
  charge: SubscriptionCharge,
  phone: string,
  method: "ecocash" | "onemoney",
) {
  const paynow = getClient();
  const payment = paynow.createPayment(charge.reference, charge.authEmail);
  payment.add(charge.description, charge.amountUsd);
  return paynow.sendMobile(payment, phone, method);
}

/**
 * Webhook hardening (spec: Security §2) — verify the hash on the raw
 * callback payload, then RE-POLL Paynow's own status endpoint before ever
 * marking anything paid. Never trust the webhook payload amount directly.
 */
export async function verifyAndPollWebhook(
  payload: Record<string, string>,
  pollUrl: string,
) {
  const paynow = getClient();
  if (!paynow.verifyHash(payload)) {
    throw new Error("Paynow webhook hash mismatch — rejecting callback");
  }
  return paynow.pollTransaction(pollUrl);
}
