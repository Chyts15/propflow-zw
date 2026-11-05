import { describe, expect, it } from "vitest";
import {
  balanceUsd,
  daysBetween,
  daysLate,
  dueYmd,
  isOverdueRecord,
  summarizeOverdue,
  ymd,
  type OwingRentRecord,
} from "../rent-timing";

const rec = (over: Partial<OwingRentRecord> = {}): OwingRentRecord => ({
  unitId: "u1",
  status: "PENDING",
  paidAt: null,
  periodMonth: 10,
  periodYear: 2026,
  rentDueDay: 5,
  amountDueUsd: 600,
  amountPaidUsd: 0,
  ...over,
});

describe("daysBetween", () => {
  it("counts calendar days across month and year ends", () => {
    expect(daysBetween(ymd(2026, 10, 5), ymd(2026, 10, 17))).toBe(12);
    expect(daysBetween(ymd(2026, 12, 30), ymd(2027, 1, 2))).toBe(3);
    expect(daysBetween(ymd(2026, 10, 17), ymd(2026, 10, 5))).toBe(-12);
  });
});

describe("isOverdueRecord / daysLate", () => {
  it("is not overdue on the due day, overdue the day after", () => {
    expect(isOverdueRecord(rec(), ymd(2026, 10, 5))).toBe(false);
    expect(isOverdueRecord(rec(), ymd(2026, 10, 6))).toBe(true);
    expect(daysLate(rec(), ymd(2026, 10, 6))).toBe(1);
    expect(daysLate(rec(), ymd(2026, 10, 5))).toBe(0);
  });

  it("treats part-paid rent as overdue, and paid or waived rent as never overdue", () => {
    expect(isOverdueRecord(rec({ status: "PARTIAL", amountPaidUsd: 300 }), ymd(2026, 10, 20))).toBe(true);
    expect(isOverdueRecord(rec({ status: "PAID" }), ymd(2026, 10, 20))).toBe(false);
    expect(isOverdueRecord(rec({ status: "WAIVED" }), ymd(2026, 10, 20))).toBe(false);
  });

  it("clamps a due day past the end of the month", () => {
    expect(dueYmd(2026, 6, 31)).toBe(ymd(2026, 6, 30));
  });
});

describe("balanceUsd", () => {
  it("is what is left, never negative", () => {
    expect(balanceUsd({ amountDueUsd: 600, amountPaidUsd: 250 })).toBe(350);
    expect(balanceUsd({ amountDueUsd: 600, amountPaidUsd: 700 })).toBe(0);
  });
});

describe("summarizeOverdue", () => {
  const today = ymd(2026, 10, 17);

  it("counts only what is owed on part-paid rent", () => {
    const s = summarizeOverdue([rec({ status: "PARTIAL", amountPaidUsd: 250 })], today);
    expect(s.usd).toBe(350);
    expect(s.unitCount).toBe(1);
  });

  it("counts a tenant two months behind as one unit but both balances", () => {
    const s = summarizeOverdue(
      [rec({ periodMonth: 9 }), rec({ periodMonth: 10, amountDueUsd: 600 })],
      today,
    );
    expect(s.usd).toBe(1200);
    expect(s.unitCount).toBe(1);
    expect(s.oldest).toEqual({ year: 2026, month: 9 });
  });

  it("splits out what predates a given period, across a year boundary", () => {
    const s = summarizeOverdue(
      [rec({ periodYear: 2025, periodMonth: 12, unitId: "u2" }), rec({ periodMonth: 10 })],
      today,
    );
    expect(s.usdBefore(2026 * 100 + 10)).toBe(600);
    expect(s.oldest).toEqual({ year: 2025, month: 12 });
  });

  it("ignores rent that is not yet due and reports nothing oldest", () => {
    const s = summarizeOverdue([rec({ periodMonth: 10, rentDueDay: 28 })], today);
    expect(s.usd).toBe(0);
    expect(s.unitCount).toBe(0);
    expect(s.oldest).toBeNull();
  });
});
