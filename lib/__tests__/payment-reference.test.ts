import { describe, expect, it } from "vitest";
import {
  ECOCASH_REF,
  MAX_REFERENCE_LENGTH,
  normalizeReference,
  parseProofDraft,
  proofDraftKey,
  referenceProblem,
  serializeProofDraft,
} from "../payment-reference";

describe("normalizeReference", () => {
  it("trims and uppercases", () => {
    expect(normalizeReference("  ec2406123456 ", "ECOCASH")).toBe("EC2406123456");
    expect(normalizeReference("  fnb ref 77 ", "BANK_TRANSFER")).toBe("FNB REF 77");
  });

  it("strips the spaces and dashes people copy into an EcoCash reference", () => {
    expect(normalizeReference("EC 2406 123456", "ECOCASH")).toBe("EC2406123456");
    expect(normalizeReference("ec-2406-123456", "ECOCASH")).toBe("EC2406123456");
  });

  it("keeps a single space inside other methods' references", () => {
    expect(normalizeReference("FNB   REF   77", "BANK_TRANSFER")).toBe("FNB REF 77");
  });

  it("caps the length at what the server accepts", () => {
    expect(normalizeReference("x".repeat(80), "INNBUCKS")).toHaveLength(MAX_REFERENCE_LENGTH);
  });

  it("produces something the server regex accepts for a messy EcoCash reference", () => {
    expect(ECOCASH_REF.test(normalizeReference(" ec 2406123456\n", "ECOCASH"))).toBe(true);
  });
});

describe("referenceProblem", () => {
  it("accepts a valid EcoCash reference typed loosely", () => {
    expect(referenceProblem("ec2406123456", "ECOCASH")).toBeNull();
  });

  it("asks for a reference when an EcoCash one is missing", () => {
    expect(referenceProblem("   ", "ECOCASH")).toMatch(/Enter your EcoCash reference/);
  });

  it("explains the shape when an EcoCash reference is wrong", () => {
    expect(referenceProblem("EC123", "ECOCASH")).toMatch(/EC followed by 10 digits/);
    expect(referenceProblem("AB2406123456", "ECOCASH")).toMatch(/EC followed by 10 digits/);
    expect(referenceProblem("EC24061234567", "ECOCASH")).toMatch(/EC followed by 10 digits/);
  });

  it("does not require a reference for other methods", () => {
    expect(referenceProblem("", "CASH_USD")).toBeNull();
    expect(referenceProblem("anything", "BANK_TRANSFER")).toBeNull();
  });
});

describe("proof draft", () => {
  it("round-trips method and reference", () => {
    const raw = serializeProofDraft({ method: "ONEMONEY", referenceNo: "OM123" });
    expect(parseProofDraft(raw)).toEqual({ method: "ONEMONEY", referenceNo: "OM123" });
  });

  it("treats a missing, corrupt or foreign value as no draft", () => {
    expect(parseProofDraft(null)).toBeNull();
    expect(parseProofDraft("")).toBeNull();
    expect(parseProofDraft("not json")).toBeNull();
    expect(parseProofDraft("42")).toBeNull();
    expect(parseProofDraft(JSON.stringify({ method: "BITCOIN", referenceNo: "x" }))).toBeNull();
    expect(parseProofDraft(JSON.stringify({ method: "ECOCASH", referenceNo: 7 }))).toBeNull();
  });

  it("never restores more than the server accepts", () => {
    const raw = JSON.stringify({ method: "ECOCASH", referenceNo: "E".repeat(200) });
    expect(parseProofDraft(raw)?.referenceNo).toHaveLength(MAX_REFERENCE_LENGTH);
  });

  it("keys the draft by rent record, so two months never share one", () => {
    expect(proofDraftKey("a")).not.toBe(proofDraftKey("b"));
  });
});
