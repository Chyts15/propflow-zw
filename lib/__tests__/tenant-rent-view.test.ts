import { describe, expect, it } from "vitest";
import { ymd } from "../rent-timing";
import {
  COMPLAINT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  buildHistoryRow,
  buildRentCardView,
  buildRentOverview,
  pickFocusRecord,
  usd,
  zig,
  type TenantRentRecord,
} from "../tenant-rent-view";

const rec = (over: Partial<TenantRentRecord> = {}): TenantRentRecord => ({
  id: "r1",
  periodMonth: 6,
  periodYear: 2026,
  amountDueUsd: 150,
  amountDueZig: 4050,
  amountPaidUsd: 0,
  status: "PENDING",
  paidAt: null,
  paymentMethod: null,
  referenceNo: null,
  proofImageUrl: null,
  ...over,
});

// The rent is due on the 5th, a Friday in June 2026.
const DUE_DAY = 5;

describe("money text", () => {
  it("shows USD after the amount and ZiG with its own prefix", () => {
    expect(usd(1200)).toBe("$1,200 USD");
    expect(zig(15000)).toBe("ZiG 15,000");
  });

  it("shows cents only when there are some", () => {
    expect(usd(150.5)).toBe("$150.50 USD");
    expect(usd(150)).toBe("$150 USD");
    expect(zig(4050.4)).toBe("ZiG 4,050");
  });
});

describe("buildRentCardView: what is owed and by when", () => {
  it("says when rent is due and how far away that is", () => {
    const v = buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 1));
    expect(v.state).toBe("DUE");
    expect(v.statusLabel).toBe("Due");
    expect(v.periodLabel).toBe("June 2026");
    expect(v.dateLine).toBe("Due Friday, 5 June 2026");
    expect(v.timingNote).toBe("Due in 4 days");
    expect(v.owedUsdText).toBe("$150 USD");
    expect(v.owedZigText).toBe("≈ ZiG 4,050");
  });

  it("uses singular and 'today' wording at the edges", () => {
    expect(buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 4)).timingNote).toBe("Due in 1 day");
    expect(buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 5)).timingNote).toBe("Due today");
    expect(buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 5)).state).toBe("DUE");
  });

  it("calls rent overdue from the day after its due date, and counts the days late", () => {
    const v = buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 17));
    expect(v.state).toBe("OVERDUE");
    expect(v.statusLabel).toBe("Overdue");
    expect(v.dateLine).toBe("Was due Friday, 5 June 2026");
    expect(v.timingNote).toBe("12 days late");
    expect(buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 6)).timingNote).toBe("1 day late");
  });

  it("agrees with the landlord rule when the record is flagged OVERDUE", () => {
    const v = buildRentCardView(rec({ status: "OVERDUE" }), DUE_DAY, ymd(2026, 6, 20));
    expect(v.state).toBe("OVERDUE");
    expect(v.timingNote).toBe("15 days late");
  });

  it("clamps a due day past the end of the month, as the cron does", () => {
    const v = buildRentCardView(rec(), 31, ymd(2026, 6, 28));
    expect(v.dateLine).toBe("Due Tuesday, 30 June 2026");
  });

  it("defaults to the 1st when the tenancy has no due day", () => {
    expect(buildRentCardView(rec(), null, ymd(2026, 5, 20)).dateLine).toBe("Due Monday, 1 June 2026");
  });
});

describe("buildRentCardView: part payments", () => {
  const partial = rec({ status: "PARTIAL", amountPaidUsd: 50 });

  it("shows only the balance as owed, with ZiG at the same rate", () => {
    const v = buildRentCardView(partial, DUE_DAY, ymd(2026, 6, 1));
    expect(v.state).toBe("PARTIAL");
    expect(v.statusLabel).toBe("Part paid");
    expect(v.owedUsdText).toBe("$100 USD");
    expect(v.owedZigText).toBe("≈ ZiG 2,700");
    expect(v.partPaidText).toBe("$50 USD of $150 USD paid so far");
  });

  it("still shows overdue when part-paid rent is late", () => {
    const v = buildRentCardView(partial, DUE_DAY, ymd(2026, 6, 20));
    expect(v.state).toBe("OVERDUE");
    expect(v.owedUsdText).toBe("$100 USD");
    expect(v.partPaidText).toBe("$50 USD of $150 USD paid so far");
  });

  it("copes with cents in the balance", () => {
    const v = buildRentCardView(rec({ status: "PARTIAL", amountDueUsd: 150, amountPaidUsd: 0.1 }), DUE_DAY, ymd(2026, 6, 1));
    expect(v.owedUsdText).toBe("$149.90 USD");
  });

  it("omits ZiG when the record has none", () => {
    const v = buildRentCardView(rec({ amountDueZig: null }), DUE_DAY, ymd(2026, 6, 1));
    expect(v.owedZigText).toBeNull();
  });
});

describe("buildRentCardView: did my proof land", () => {
  it("invites a proof when none is on file", () => {
    const v = buildRentCardView(rec(), DUE_DAY, ymd(2026, 6, 1));
    expect(v.proofSent).toBe(false);
    expect(v.proofNote).toMatch(/Upload your proof/);
    expect(v.canUploadProof).toBe(true);
  });

  it("says the proof is waiting on the landlord once it is sent", () => {
    const v = buildRentCardView(rec({ proofImageUrl: "https://files.example/p.jpg" }), DUE_DAY, ymd(2026, 6, 1));
    expect(v.proofSent).toBe(true);
    expect(v.proofNote).toBe("Proof sent. Waiting for your landlord to confirm.");
    expect(v.canUploadProof).toBe(true);
  });

  it("does not claim a part-paid record's old proof is waiting", () => {
    const v = buildRentCardView(
      rec({ status: "PARTIAL", amountPaidUsd: 50, proofImageUrl: "https://files.example/p.jpg" }),
      DUE_DAY,
      ymd(2026, 6, 1),
    );
    expect(v.proofNote).toMatch(/recorded \$50 USD/);
    expect(v.proofNote).toMatch(/send a new proof/);
  });
});

describe("buildRentCardView: settled rent", () => {
  it("hides upload and owes nothing once PAID", () => {
    const v = buildRentCardView(
      rec({ status: "PAID", amountPaidUsd: 150, paidAt: new Date("2026-06-04T09:00:00Z"), proofImageUrl: "https://files.example/p.jpg" }),
      DUE_DAY,
      ymd(2026, 6, 20),
    );
    expect(v.state).toBe("PAID");
    expect(v.canUploadProof).toBe(false);
    expect(v.owedUsdText).toBeNull();
    expect(v.timingNote).toBeNull();
    expect(v.dateLine).toBe("Paid Thursday, 4 June 2026");
    expect(v.proofSent).toBe(false);
  });

  it("copes with a PAID record that has no paid date", () => {
    const v = buildRentCardView(rec({ status: "PAID", amountPaidUsd: 150 }), DUE_DAY, ymd(2026, 6, 20));
    expect(v.dateLine).toBeNull();
    expect(v.canUploadProof).toBe(false);
  });

  it("hides upload and owes nothing once WAIVED", () => {
    const v = buildRentCardView(rec({ status: "WAIVED" }), DUE_DAY, ymd(2026, 6, 20));
    expect(v.state).toBe("WAIVED");
    expect(v.statusLabel).toBe("Waived");
    expect(v.canUploadProof).toBe(false);
    expect(v.owedUsdText).toBeNull();
    expect(v.proofNote).toMatch(/waived/);
  });
});

describe("pickFocusRecord", () => {
  const newestFirst = [
    rec({ id: "jun", periodMonth: 6, status: "PENDING" }),
    rec({ id: "may", periodMonth: 5, status: "OVERDUE" }),
    rec({ id: "apr", periodMonth: 4, status: "PAID" }),
  ];

  it("focuses the oldest unpaid month and counts the rest", () => {
    const { focus, otherUnpaid } = pickFocusRecord(newestFirst);
    expect(focus?.id).toBe("may");
    expect(otherUnpaid).toBe(1);
  });

  it("focuses the latest month when everything is settled", () => {
    const { focus, otherUnpaid } = pickFocusRecord([rec({ id: "jun", status: "PAID" }), rec({ id: "may", status: "WAIVED" })]);
    expect(focus?.id).toBe("jun");
    expect(otherUnpaid).toBe(0);
  });

  it("has no focus when there are no records", () => {
    expect(pickFocusRecord([])).toEqual({ focus: undefined, otherUnpaid: 0 });
  });
});

describe("buildHistoryRow", () => {
  it("uses labels, not enums, and long dates", () => {
    const row = buildHistoryRow(
      rec({
        periodMonth: 5,
        status: "PAID",
        amountPaidUsd: 150,
        paidAt: new Date("2026-05-04T09:00:00Z"),
        paymentMethod: "BANK_TRANSFER",
        referenceNo: "FNB-4471",
      }),
      DUE_DAY,
      ymd(2026, 6, 20),
    );
    expect(row.periodLabel).toBe("May 2026");
    expect(row.statusLabel).toBe("Paid");
    expect(row.amountText).toBe("$150 USD");
    expect(row.zigText).toBe("≈ ZiG 4,050");
    expect(row.details).toEqual(["Paid Monday, 4 May 2026", "Method: Bank transfer", "Reference: FNB-4471"]);
  });

  it("shows an old unpaid month as overdue with what is still owed", () => {
    const row = buildHistoryRow(rec({ periodMonth: 5, status: "PARTIAL", amountPaidUsd: 50 }), DUE_DAY, ymd(2026, 6, 20));
    expect(row.statusLabel).toBe("Overdue");
    expect(row.amountText).toBe("$100 USD");
    expect(row.details[0]).toBe("Was due Tuesday, 5 May 2026");
    expect(row.details).toContain("$50 USD of $150 USD paid so far");
  });
});

describe("buildRentOverview", () => {
  it("builds the card for the oldest unpaid month and lists every other month as history", () => {
    const records = [
      rec({ id: "jun", periodMonth: 6 }),
      rec({ id: "may", periodMonth: 5, status: "OVERDUE" }),
      rec({ id: "apr", periodMonth: 4, status: "PAID", amountPaidUsd: 150 }),
    ];
    const overview = buildRentOverview(records, DUE_DAY, ymd(2026, 6, 10));
    expect(overview?.focus.id).toBe("may");
    expect(overview?.view.periodLabel).toBe("May 2026");
    expect(overview?.view.state).toBe("OVERDUE");
    expect(overview?.otherUnpaid).toBe(1);
    expect(overview?.history.map((h) => h.id)).toEqual(["jun", "apr"]);
  });

  it("is null when there are no records yet", () => {
    expect(buildRentOverview([], DUE_DAY, ymd(2026, 6, 10))).toBeNull();
  });
});

describe("label maps", () => {
  it("name every payment method in words", () => {
    expect(PAYMENT_METHOD_LABEL.ECOCASH).toBe("EcoCash");
    expect(PAYMENT_METHOD_LABEL.BANK_TRANSFER).toBe("Bank transfer");
    for (const label of Object.values(PAYMENT_METHOD_LABEL)) expect(label).not.toMatch(/_|^[A-Z]+$/);
  });

  it("name every complaint status in words", () => {
    expect(COMPLAINT_STATUS_LABEL.PENDING_PARTS).toBe("Waiting for parts");
    expect(COMPLAINT_STATUS_LABEL.IN_PROGRESS).toBe("In progress");
    for (const label of Object.values(COMPLAINT_STATUS_LABEL)) expect(label).not.toMatch(/_/);
  });
});
