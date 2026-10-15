// Payment reference rules for the tenant proof form. Pure, so the form's checks can be tested
// without a browser. The server enforces the same EcoCash shape in lib/routers/rent.ts.

export const ECOCASH_REF = /^EC\d{10}$/;
export const MAX_REFERENCE_LENGTH = 40;

export type ProofMethod = "ECOCASH" | "ONEMONEY" | "INNBUCKS" | "BANK_TRANSFER" | "CASH_USD";

const METHODS: readonly ProofMethod[] = ["ECOCASH", "ONEMONEY", "INNBUCKS", "BANK_TRANSFER", "CASH_USD"];

/**
 * What a tenant typed, tidied up: trimmed and uppercased for every method. EcoCash references also
 * lose spaces and dashes, because people copy them as "EC 2406 123456" or "ec-2406123456".
 */
export function normalizeReference(raw: string, method: ProofMethod): string {
  const trimmed = raw.trim().toUpperCase();
  const tidy = method === "ECOCASH" ? trimmed.replace(/[\s\-.]+/g, "") : trimmed.replace(/\s+/g, " ");
  return tidy.slice(0, MAX_REFERENCE_LENGTH);
}

/** Plain-language reason a reference cannot be sent, or null when it is fine. */
export function referenceProblem(raw: string, method: ProofMethod): string | null {
  if (method !== "ECOCASH") return null;
  const ref = normalizeReference(raw, method);
  if (ref === "") return "Enter your EcoCash reference. It starts with EC, then 10 digits.";
  if (!ECOCASH_REF.test(ref)) return "An EcoCash reference is EC followed by 10 digits, like EC2406123456.";
  return null;
}

// What the proof form keeps in sessionStorage so a dropped connection or an accidental reload
// does not wipe what the tenant already typed. The photo itself cannot be stored.
export type ProofDraft = { method: ProofMethod; referenceNo: string };

export const proofDraftKey = (rentRecordId: string) => `propflow:proof-draft:${rentRecordId}`;

export function serializeProofDraft(draft: ProofDraft): string {
  return JSON.stringify({ method: draft.method, referenceNo: draft.referenceNo.slice(0, MAX_REFERENCE_LENGTH) });
}

/** Reads a stored draft defensively: anything malformed is treated as no draft. */
export function parseProofDraft(raw: string | null): ProofDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { method, referenceNo } = value as Record<string, unknown>;
    if (typeof method !== "string" || !(METHODS as readonly string[]).includes(method)) return null;
    if (typeof referenceNo !== "string") return null;
    return { method: method as ProofMethod, referenceNo: referenceNo.slice(0, MAX_REFERENCE_LENGTH) };
  } catch {
    return null;
  }
}
