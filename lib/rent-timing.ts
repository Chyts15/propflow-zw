// Rent timing rules shared by the landlord dashboard. Pure functions, no database or
// framework imports, so they can be tested on their own.
//
// RentRecord has no due-date column. A record's due date is its period plus the
// tenancy's rentDueDay (default 1), the same derivation the rent-reminders cron uses,
// and that cron sends its first "overdue" notice the day AFTER the due date. These
// helpers follow both rules, and compare calendar days in Zimbabwe time (CAT, UTC+2)
// rather than the server's zone, which is UTC on Vercel.

import { round2 } from "./money";

export const ZIMBABWE_TZ = "Africa/Harare";

/** A calendar day as a sortable integer: 2026-06-22 becomes 20260622. */
export type Ymd = number;

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZIMBABWE_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function ymd(year: number, month: number, day: number): Ymd {
  return year * 10000 + month * 100 + day;
}

/** The Zimbabwe calendar day a moment falls on. */
export function ymdOf(date: Date): Ymd {
  const parts = Object.fromEntries(dayFormat.formatToParts(date).map((p) => [p.type, Number(p.value)]));
  return ymd(parts.year, parts.month, parts.day);
}

export function periodOf(day: Ymd) {
  return { year: Math.floor(day / 10000), month: Math.floor(day / 100) % 100 };
}

/** Due date of a rent record. rentDueDay is clamped to the month (31 in June is the 30th). */
export function dueYmd(periodYear: number, periodMonth: number, rentDueDay: number | null | undefined): Ymd {
  const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  return ymd(periodYear, periodMonth, Math.min(Math.max(rentDueDay ?? 1, 1), daysInMonth));
}

export type TimedRentRecord = {
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED";
  paidAt: Date | null;
  periodMonth: number;
  periodYear: number;
  rentDueDay: number | null | undefined;
};

/** Unpaid and either flagged OVERDUE or past its due date (the day after, as the cron does). */
export function isOverdueRecord(r: TimedRentRecord, today: Ymd): boolean {
  if (r.status === "OVERDUE") return true;
  if (r.status !== "PENDING" && r.status !== "PARTIAL") return false;
  return today > dueYmd(r.periodYear, r.periodMonth, r.rentDueDay);
}

/** Whole calendar days from `from` to `to`; negative when `to` is the earlier day. */
export function daysBetween(from: Ymd, to: Ymd): number {
  const utc = (d: Ymd) => Date.UTC(Math.floor(d / 10000), (Math.floor(d / 100) % 100) - 1, d % 100);
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Days past the due date; 0 when the record is not past due. */
export function daysLate(r: TimedRentRecord, today: Ymd): number {
  return Math.max(daysBetween(dueYmd(r.periodYear, r.periodMonth, r.rentDueDay), today), 0);
}

/** What is still owed on a record, never negative. */
export function balanceUsd(r: { amountDueUsd: number; amountPaidUsd: number }): number {
  return Math.max(round2(r.amountDueUsd - r.amountPaidUsd), 0);
}

export type OwingRentRecord = TimedRentRecord & {
  unitId: string;
  amountDueUsd: number;
  amountPaidUsd: number;
};

/**
 * The single definition of "overdue" shared by the dashboard, the rent ledger and its stats:
 * unpaid or part-paid rent past its due date, from ANY period. `usd` is the remaining balance
 * (a part-paid record owes only what is left), and `unitCount` counts units, not records, so a
 * tenant two months behind is one unit.
 */
export function summarizeOverdue<R extends OwingRentRecord>(records: R[], today: Ymd) {
  const overdue = records.filter((r) => isOverdueRecord(r, today));
  const usd = round2(overdue.reduce((sum, r) => sum + balanceUsd(r), 0));
  const unitCount = new Set(overdue.map((r) => r.unitId)).size;
  const periodKey = (r: R) => r.periodYear * 100 + r.periodMonth;
  const oldestKey = overdue.length === 0 ? null : Math.min(...overdue.map(periodKey));
  return {
    records: overdue,
    usd,
    unitCount,
    /** Period (year/month) of the oldest overdue record, for linking to it. */
    oldest: oldestKey === null ? null : { year: Math.floor(oldestKey / 100), month: oldestKey % 100 },
    /** Balance overdue from periods before the given one (year*100 + month). */
    usdBefore: (key: number) =>
      round2(overdue.filter((r) => periodKey(r) < key).reduce((sum, r) => sum + balanceUsd(r), 0)),
  };
}

/**
 * On-time collections: of the rent that has fallen due, how much was paid on or before
 * its due date.
 *
 * - Rent due before today counts. Rent due today counts only once it is paid, so a
 *   tenant is not scored late on the due day itself.
 * - Rent not yet due and waived rent are left out.
 * - A PAID record with no paidAt is counted as on time: nothing says it was late.
 * - pct is null when nothing has fallen due, so callers can say so instead of "0%".
 */
export function summarizeOnTime(records: TimedRentRecord[], today: Ymd) {
  let due = 0;
  let onTime = 0;
  for (const r of records) {
    if (r.status === "WAIVED") continue;
    const dueDay = dueYmd(r.periodYear, r.periodMonth, r.rentDueDay);
    const paid = r.status === "PAID";
    if (dueDay > today || (dueDay === today && !paid)) continue;
    due += 1;
    if (paid && (!r.paidAt || ymdOf(r.paidAt) <= dueDay)) onTime += 1;
  }
  return { due, onTime, pct: due === 0 ? null : Math.round((onTime / due) * 100) };
}
