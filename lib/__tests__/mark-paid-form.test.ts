import { describe, expect, it } from "vitest";
import { amountOutcome, leftAfter, referenceError, referenceToSend } from "../mark-paid-form";

describe("amountOutcome", () => {
  it("settles when the amount is exactly what is still owed", () => {
    expect(amountOutcome(250, "250")).toBe("settles");
    expect(amountOutcome(250, "250.00")).toBe("settles");
  });

  it("is partial when less is received", () => {
    expect(amountOutcome(250, "100")).toBe("partial");
    expect(amountOutcome(250, "0.01")).toBe("partial");
  });

  it("refuses more than is owed, to the cent", () => {
    expect(amountOutcome(250, "250.01")).toBe("over");
    expect(amountOutcome(250, "1000")).toBe("over");
  });

  it("treats empty, zero, negative and junk as nothing entered", () => {
    expect(amountOutcome(250, "")).toBe("empty");
    expect(amountOutcome(250, "   ")).toBe("empty");
    expect(amountOutcome(250, "0")).toBe("empty");
    expect(amountOutcome(250, "-5")).toBe("empty");
    expect(amountOutcome(250, "abc")).toBe("empty");
  });

  it("compares in cents so floating point drift can't turn a full payment into a short one", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    expect(amountOutcome(0.1 + 0.2, "0.3")).toBe("settles");
    expect(amountOutcome(19.99, "19.99")).toBe("settles");
  });

  it("works against a part-paid balance", () => {
    expect(amountOutcome(150, "150")).toBe("settles");
    expect(amountOutcome(150, "151")).toBe("over");
  });
});

describe("leftAfter", () => {
  it("is what stays owed after a short payment, rounded to cents", () => {
    expect(leftAfter(250, "100")).toBe(150);
    expect(leftAfter(0.3, "0.1")).toBe(0.2);
  });
});

describe("referenceError", () => {
  it("only asks for a reference on EcoCash", () => {
    expect(referenceError("CASH_USD", "")).toBeNull();
    expect(referenceError("BANK_TRANSFER", "anything at all")).toBeNull();
    expect(referenceError("ONEMONEY", "")).toBeNull();
  });

  it("wants EC plus 10 digits for EcoCash", () => {
    expect(referenceError("ECOCASH", "EC2406123456")).toBeNull();
    expect(referenceError("ECOCASH", "")).toMatch(/Enter the EcoCash reference/);
    expect(referenceError("ECOCASH", "EC12345")).toMatch(/EC followed by 10 digits/);
    expect(referenceError("ECOCASH", "2406123456")).toMatch(/EC followed by 10 digits/);
    expect(referenceError("ECOCASH", "EC24061234567")).toMatch(/EC followed by 10 digits/);
  });

  it("accepts the way people copy a reference: lower case, spaces, dashes", () => {
    expect(referenceError("ECOCASH", "ec 2406 123456")).toBeNull();
    expect(referenceError("ECOCASH", " EC-2406123456 ")).toBeNull();
  });
});

describe("referenceToSend", () => {
  it("sends the tidied EcoCash reference the server's strict check will accept", () => {
    expect(referenceToSend("ECOCASH", "ec 2406 123456")).toBe("EC2406123456");
    expect(referenceToSend("ECOCASH", "EC2406123456")).toBe("EC2406123456");
  });

  it("keeps other references as typed, only trimmed", () => {
    expect(referenceToSend("BANK_TRANSFER", "  Stanbic ref 77a  ")).toBe("Stanbic ref 77a");
    expect(referenceToSend("CASH_USD", "")).toBeUndefined();
    expect(referenceToSend("CASH_ZIG", "   ")).toBeUndefined();
  });

  it("never sends more than the server accepts (40 characters)", () => {
    expect(referenceToSend("BANK_TRANSFER", "x".repeat(80))).toHaveLength(40);
  });
});
