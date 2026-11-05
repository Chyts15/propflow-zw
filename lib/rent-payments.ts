// Payment rules for a rent record, as pure functions the database layer calls inside a
// transaction. Nothing here touches Prisma, so the money logic can be tested on its own.
//
// A landlord records what was RECEIVED. The record becomes PAID only when received money covers
// what is due; anything short leaves it PARTIAL with the balance still owed. Every change writes a
// PaymentEvent, and an undo is a new event with a negative amount, never an edit or a delete, so
// the history always adds up to what the record says.

import { round2, toCents } from "./money";

type Payable = { amountDueUsd: number; amountPaidUsd: number; status: string };

export type PaymentCheck =
  | { ok: true; newPaidUsd: number; status: "PAID" | "PARTIAL"; remainingUsd: number }
  | { ok: false; reason: "ALREADY_SETTLED" | "NOT_POSITIVE" | "EXCEEDS_BALANCE"; remainingUsd: number };

/** What recording `receivedUsd` against this record would do, or why it is refused. */
export function checkPayment(record: Payable, receivedUsd: number): PaymentCheck {
  const remainingUsd = Math.max(round2(record.amountDueUsd - record.amountPaidUsd), 0);
  if (record.status === "PAID" || record.status === "WAIVED") {
    return { ok: false, reason: "ALREADY_SETTLED", remainingUsd };
  }
  const received = toCents(receivedUsd);
  if (!Number.isFinite(receivedUsd) || received <= 0) return { ok: false, reason: "NOT_POSITIVE", remainingUsd };
  if (received > toCents(remainingUsd)) return { ok: false, reason: "EXCEEDS_BALANCE", remainingUsd };

  const newPaidCents = toCents(record.amountPaidUsd) + received;
  const settled = newPaidCents >= toCents(record.amountDueUsd);
  return {
    ok: true,
    newPaidUsd: newPaidCents / 100,
    status: settled ? "PAID" : "PARTIAL",
    remainingUsd: Math.max(toCents(record.amountDueUsd) - newPaidCents, 0) / 100,
  };
}

export type PaymentEventLike = {
  id: string;
  amountUsd: number | null;
  method: string | null;
  createdAt: Date;
};

/**
 * The payment an undo would reverse: events are replayed oldest first, a payment pushes onto a
 * stack and a reversal (negative amount) pops the payment it cancels. The top of what is left is
 * the latest payment still standing, so repeated undos walk back through payments in order.
 * Events without an amount (status notes) are ignored.
 */
export function undoablePayment<E extends PaymentEventLike>(eventsOldestFirst: E[]): E | null {
  const standing: E[] = [];
  for (const event of eventsOldestFirst) {
    if (event.amountUsd == null || event.amountUsd === 0) continue;
    if (event.amountUsd > 0) standing.push(event);
    else standing.pop();
  }
  return standing.at(-1) ?? null;
}

/** The record's state once `reversedUsd` is taken back out. Never PAID: money was removed. */
export function afterReversal(record: Pick<Payable, "amountPaidUsd">, reversedUsd: number) {
  const newPaidUsd = Math.max(toCents(record.amountPaidUsd) - toCents(reversedUsd), 0) / 100;
  return { newPaidUsd, status: (newPaidUsd > 0 ? "PARTIAL" : "PENDING") as "PARTIAL" | "PENDING" };
}

/** Proof of payment only makes sense for rent that is still owed. Null means it can be attached. */
export function proofRefusal(status: string): string | null {
  return status === "PAID" || status === "WAIVED"
    ? "This month is already settled, so there is no proof to upload."
    : null;
}

/** Plain-language reason for a refused payment. */
export function paymentRefusal(check: Extract<PaymentCheck, { ok: false }>): string {
  switch (check.reason) {
    case "ALREADY_SETTLED":
      return "This rent is already settled. Refresh the page to see the latest.";
    case "NOT_POSITIVE":
      return "Enter the amount you received.";
    case "EXCEEDS_BALANCE":
      return `Only $${check.remainingUsd.toLocaleString("en-US")} USD is still owed on this rent. Enter that amount or less.`;
  }
}
