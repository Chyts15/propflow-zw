import { describe, expect, it } from "vitest";
import { afterReversal, checkPayment, paymentRefusal, proofRefusal, undoablePayment, type PaymentEventLike } from "../rent-payments";

const record = (over: Partial<{ amountDueUsd: number; amountPaidUsd: number; status: string }> = {}) => ({
  amountDueUsd: 600,
  amountPaidUsd: 0,
  status: "PENDING",
  ...over,
});

describe("checkPayment", () => {
  it("settles the record only when received money covers what is due", () => {
    expect(checkPayment(record(), 600)).toMatchObject({ ok: true, status: "PAID", newPaidUsd: 600, remainingUsd: 0 });
  });

  it("leaves a short payment PARTIAL with the balance still owed", () => {
    expect(checkPayment(record(), 300)).toMatchObject({ ok: true, status: "PARTIAL", newPaidUsd: 300, remainingUsd: 300 });
  });

  it("adds to what was already paid, so two halves make PAID", () => {
    expect(checkPayment(record({ amountPaidUsd: 300, status: "PARTIAL" }), 300)).toMatchObject({
      ok: true,
      status: "PAID",
      newPaidUsd: 600,
    });
  });

  it("does not let float drift decide PAID versus PARTIAL", () => {
    // 0.1 + 0.2 !== 0.3 in floats; cents make it exact.
    expect(checkPayment(record({ amountDueUsd: 0.3, amountPaidUsd: 0.1, status: "PARTIAL" }), 0.2)).toMatchObject({
      ok: true,
      status: "PAID",
    });
  });

  it("refuses more than is owed and says how much is", () => {
    const check = checkPayment(record({ amountPaidUsd: 300, status: "PARTIAL" }), 400);
    expect(check).toMatchObject({ ok: false, reason: "EXCEEDS_BALANCE", remainingUsd: 300 });
    expect(paymentRefusal(check as never)).toContain("$300 USD");
  });

  it("refuses a record that is already settled, and non-positive amounts", () => {
    expect(checkPayment(record({ status: "PAID", amountPaidUsd: 600 }), 10)).toMatchObject({ reason: "ALREADY_SETTLED" });
    expect(checkPayment(record({ status: "WAIVED" }), 10)).toMatchObject({ reason: "ALREADY_SETTLED" });
    expect(checkPayment(record(), 0)).toMatchObject({ reason: "NOT_POSITIVE" });
    expect(checkPayment(record(), -5)).toMatchObject({ reason: "NOT_POSITIVE" });
    expect(checkPayment(record(), Number.NaN)).toMatchObject({ reason: "NOT_POSITIVE" });
  });
});

const ev = (id: string, amountUsd: number | null, n: number): PaymentEventLike => ({
  id,
  amountUsd,
  method: "ECOCASH",
  createdAt: new Date(2026, 9, n),
});

describe("undoablePayment", () => {
  it("is the latest payment still standing", () => {
    expect(undoablePayment([ev("a", 300, 1), ev("b", 200, 2)])?.id).toBe("b");
  });

  it("walks back one payment at a time as reversals cancel the newest", () => {
    const events = [ev("a", 300, 1), ev("b", 200, 2), ev("rev-b", -200, 3)];
    expect(undoablePayment(events)?.id).toBe("a");
    expect(undoablePayment([...events, ev("rev-a", -300, 4)])).toBeNull();
  });

  it("offers a fresh payment after everything was reversed, and ignores notes without an amount", () => {
    const events = [ev("a", 300, 1), ev("rev-a", -300, 2), ev("note", null, 3), ev("c", 100, 4)];
    expect(undoablePayment(events)?.id).toBe("c");
    expect(undoablePayment([ev("note", null, 1)])).toBeNull();
    expect(undoablePayment([])).toBeNull();
  });
});

describe("afterReversal", () => {
  it("drops back to PARTIAL when some money remains, PENDING when none does", () => {
    expect(afterReversal({ amountPaidUsd: 600 }, 300)).toEqual({ newPaidUsd: 300, status: "PARTIAL" });
    expect(afterReversal({ amountPaidUsd: 300 }, 300)).toEqual({ newPaidUsd: 0, status: "PENDING" });
  });

  it("cannot go below zero on a legacy record whose paid amount was overwritten", () => {
    expect(afterReversal({ amountPaidUsd: 1 }, 300)).toEqual({ newPaidUsd: 0, status: "PENDING" });
  });
});

describe("proofRefusal", () => {
  it("lets proof be attached to rent that is still owed", () => {
    for (const status of ["PENDING", "PARTIAL", "OVERDUE"]) expect(proofRefusal(status)).toBeNull();
  });

  it("refuses proof on rent that is already settled, so confirmed evidence is never replaced", () => {
    expect(proofRefusal("PAID")).toMatch(/already settled/);
    expect(proofRefusal("WAIVED")).toMatch(/already settled/);
  });
});
