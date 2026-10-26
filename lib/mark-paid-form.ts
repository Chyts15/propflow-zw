// What the landlord's "record payment" form decides before it sends anything. Pure, so the
// amount outcome ("settles", "partial", "over") and the reference that gets sent are tested rather
// than eyeballed. The server re-checks all of it (lib/rent-payments.ts, lib/routers/rent.ts);
// this only keeps the form honest about what the server is about to do.

import { round2, toCents } from "./money";
import { ECOCASH_REF, MAX_REFERENCE_LENGTH, normalizeReference } from "./payment-reference";

export type AmountOutcome = "empty" | "over" | "settles" | "partial";

/** What entering `amountText` against `balanceUsd` still owed would do. */
export function amountOutcome(balanceUsd: number, amountText: string): AmountOutcome {
  const amount = Number(amountText);
  const receivedCents = Number.isFinite(amount) ? toCents(amount) : 0;
  if (receivedCents <= 0) return "empty";
  if (receivedCents > toCents(balanceUsd)) return "over";
  if (receivedCents === toCents(balanceUsd)) return "settles";
  return "partial";
}

/** USD still owed after `amountText` is received, for the "leaves $X still owed" line. */
export function leftAfter(balanceUsd: number, amountText: string): number {
  return round2(balanceUsd - Number(amountText));
}

/**
 * Why the reference can't be sent, or null. Only EcoCash needs one, and it must be EC plus 10
 * digits (the same rule the server applies). Spaces and dashes are tolerated: they are stripped
 * by `referenceToSend`, so "ec 2406 123456" is fine to type or paste.
 */
export function referenceError(method: string, raw: string): string | null {
  if (method !== "ECOCASH") return null;
  const ref = normalizeReference(raw, "ECOCASH");
  if (ref === "") return "Enter the EcoCash reference. It starts with EC, then 10 digits.";
  if (!ECOCASH_REF.test(ref)) return "An EcoCash reference is EC followed by 10 digits, like EC2406123456.";
  return null;
}

/** The reference to send: tidied for EcoCash, as typed (trimmed) for everything else, or undefined when empty. */
export function referenceToSend(method: string, raw: string): string | undefined {
  if (method === "ECOCASH") return normalizeReference(raw, "ECOCASH") || undefined;
  const tidy = raw.trim().replace(/\s+/g, " ").slice(0, MAX_REFERENCE_LENGTH);
  return tidy === "" ? undefined : tidy;
}
