// What a tenant sees about a rent record: what is owed, by when, and whether their proof landed.
// Pure functions over plain data, so the wording and the arithmetic can be tested on their own.
//
// RentRecord has no due-date column; the due date is the period plus the tenancy's rentDueDay,
// and "overdue" is the same single rule the landlord side uses (lib/rent-timing.ts), so a tenant
// and their landlord never disagree about whether rent is late.

import { formatLongDate, formatMonthName } from "./dates";
import { round2, toCents } from "./money";
import { balanceUsd, daysBetween, dueYmd, isOverdueRecord, type Ymd } from "./rent-timing";

export type RentStatusValue = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED";

export type TenantRentRecord = {
  id: string;
  periodMonth: number;
  periodYear: number;
  amountDueUsd: number;
  amountDueZig: number | null;
  amountPaidUsd: number;
  status: RentStatusValue;
  paidAt: Date | null;
  paymentMethod: string | null;
  referenceNo: string | null;
  proofImageUrl: string | null;
};

// Label maps: the database enums never reach the screen.
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ECOCASH: "EcoCash",
  ONEMONEY: "OneMoney",
  INNBUCKS: "InnBucks",
  BANK_TRANSFER: "Bank transfer",
  CASH_USD: "Cash (USD)",
  CASH_ZIG: "Cash (ZiG)",
};

export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  PENDING_PARTS: "Waiting for parts",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export type RentState = "DUE" | "PARTIAL" | "OVERDUE" | "PAID" | "WAIVED";
export type RentTone = "success" | "warning" | "danger" | "muted";

export const RENT_STATE_LABEL: Record<RentState, string> = {
  DUE: "Due",
  PARTIAL: "Part paid",
  OVERDUE: "Overdue",
  PAID: "Paid",
  WAIVED: "Waived",
};

const RENT_STATE_TONE: Record<RentState, RentTone> = {
  DUE: "warning",
  PARTIAL: "warning",
  OVERDUE: "danger",
  PAID: "success",
  WAIVED: "muted",
};

const num = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

/** "$1,200 USD" (cents shown only when there are some). */
export const usd = (n: number) => `$${num(n)} USD`;

/** "ZiG 15,000". Whole ZiG only: nobody pays in fractions of a ZiG. */
export const zig = (n: number) => `ZiG ${Math.round(n).toLocaleString("en-US")}`;

export const isUnpaid = (r: { status: RentStatusValue }) => r.status !== "PAID" && r.status !== "WAIVED";

export const periodLabel = (r: { periodMonth: number; periodYear: number }) => `${formatMonthName(r.periodMonth)} ${r.periodYear}`;

/**
 * The record the rent card is about: the OLDEST unpaid one, because that is what the tenant
 * actually owes first; if everything is settled, the latest. `records` is newest first, as the
 * tenant history query returns it. `otherUnpaid` is how many further months are still unpaid.
 */
export function pickFocusRecord<R extends { status: RentStatusValue }>(records: R[]): { focus: R | undefined; otherUnpaid: number } {
  const unpaid = records.filter(isUnpaid);
  if (unpaid.length === 0) return { focus: records[0], otherUnpaid: 0 };
  return { focus: unpaid[unpaid.length - 1], otherUnpaid: unpaid.length - 1 };
}

export type RentCardView = {
  periodLabel: string;
  state: RentState;
  statusLabel: string;
  tone: RentTone;
  /** What is still to pay, as text: "$150 USD", or null once paid or waived. */
  owedUsdText: string | null;
  owedZigText: string | null;
  /** "$50 USD of $150 USD paid so far" for a part-paid record, else null. */
  partPaidText: string | null;
  /** "Due Monday, 1 June 2026" / "Was due Monday, 1 June 2026" / "Paid Monday, 22 June 2026". */
  dateLine: string | null;
  /** "12 days late", "Due today", "Due in 5 days". */
  timingNote: string | null;
  proofSent: boolean;
  /** The answer to "did my proof land?" and what to do next. */
  proofNote: string;
  /** Upload is offered only while rent is unpaid. */
  canUploadProof: boolean;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function buildRentCardView(
  record: TenantRentRecord,
  rentDueDay: number | null | undefined,
  today: Ymd,
): RentCardView {
  const due = dueYmd(record.periodYear, record.periodMonth, rentDueDay);
  const label = periodLabel(record);

  if (record.status === "WAIVED") {
    return {
      periodLabel: label,
      state: "WAIVED",
      statusLabel: RENT_STATE_LABEL.WAIVED,
      tone: RENT_STATE_TONE.WAIVED,
      owedUsdText: null,
      owedZigText: null,
      partPaidText: null,
      dateLine: null,
      timingNote: null,
      proofSent: false,
      proofNote: "Your landlord has waived the rent for this month. You owe nothing.",
      canUploadProof: false,
    };
  }

  if (record.status === "PAID") {
    return {
      periodLabel: label,
      state: "PAID",
      statusLabel: RENT_STATE_LABEL.PAID,
      tone: RENT_STATE_TONE.PAID,
      owedUsdText: null,
      owedZigText: null,
      partPaidText: null,
      dateLine: record.paidAt ? `Paid ${formatLongDate(record.paidAt)}` : null,
      timingNote: null,
      proofSent: false,
      proofNote: "Your landlord has confirmed this payment.",
      canUploadProof: false,
    };
  }

  const balance = balanceUsd(record);
  const owedUsd = balance > 0 ? balance : record.amountDueUsd;
  const owedZig =
    record.amountDueZig != null && record.amountDueUsd > 0
      ? (record.amountDueZig * toCents(owedUsd)) / toCents(record.amountDueUsd)
      : null;

  const overdue = isOverdueRecord({ ...record, rentDueDay }, today);
  const lateDays = Math.max(daysBetween(due, today), 0);
  const untilDue = daysBetween(today, due);
  const state: RentState = overdue ? "OVERDUE" : record.status === "PARTIAL" ? "PARTIAL" : "DUE";

  let timingNote: string | null = null;
  if (overdue) timingNote = lateDays > 0 ? `${plural(lateDays, "day")} late` : "Overdue";
  else if (untilDue === 0) timingNote = "Due today";
  else if (untilDue > 0) timingNote = `Due in ${plural(untilDue, "day")}`;

  const paid = round2(record.amountPaidUsd);
  const proofSent = Boolean(record.proofImageUrl);
  let proofNote: string;
  if (!proofSent) proofNote = "Already paid? Upload your proof so your landlord can confirm it.";
  else if (paid > 0) proofNote = `Your landlord has recorded ${usd(paid)}. If you've paid the rest, send a new proof.`;
  else proofNote = "Proof sent. Waiting for your landlord to confirm.";

  return {
    periodLabel: label,
    state,
    statusLabel: RENT_STATE_LABEL[state],
    tone: RENT_STATE_TONE[state],
    owedUsdText: usd(owedUsd),
    owedZigText: owedZig != null ? `≈ ${zig(owedZig)}` : null,
    partPaidText: paid > 0 ? `${usd(paid)} of ${usd(record.amountDueUsd)} paid so far` : null,
    dateLine: `${overdue ? "Was due" : "Due"} ${formatLongDate(due)}`,
    timingNote,
    proofSent,
    proofNote,
    canUploadProof: true,
  };
}

/**
 * Everything the rent card and payment history need from a tenant's records (newest first):
 * the focus record with its card view, how many other months are unpaid, and the history rows
 * for every other record. Null when the tenant has no rent records yet.
 */
export function buildRentOverview<R extends TenantRentRecord>(
  records: R[],
  rentDueDay: number | null | undefined,
  today: Ymd,
) {
  const { focus, otherUnpaid } = pickFocusRecord(records);
  if (!focus) return null;
  return {
    focus,
    view: buildRentCardView(focus, rentDueDay, today),
    otherUnpaid,
    history: records.filter((r) => r.id !== focus.id).map((r) => buildHistoryRow(r, rentDueDay, today)),
  };
}

export type HistoryRowView = {
  id: string;
  periodLabel: string;
  statusLabel: string;
  tone: RentTone;
  amountText: string;
  zigText: string | null;
  /** Lines shown when the row is opened. */
  details: string[];
};

/** One line of the payment history list, in the same words as the rent card. */
export function buildHistoryRow(record: TenantRentRecord, rentDueDay: number | null | undefined, today: Ymd): HistoryRowView {
  const view = buildRentCardView(record, rentDueDay, today);

  const details: string[] = [];
  if (view.dateLine) details.push(view.dateLine);
  if (view.partPaidText) details.push(view.partPaidText);
  if (record.paymentMethod) details.push(`Method: ${PAYMENT_METHOD_LABEL[record.paymentMethod] ?? "Other"}`);
  if (record.referenceNo) details.push(`Reference: ${record.referenceNo}`);
  if (view.state === "WAIVED") details.push(view.proofNote);

  return {
    id: record.id,
    periodLabel: view.periodLabel,
    statusLabel: view.statusLabel,
    tone: view.tone,
    // Paid and waived rows show the month's full amount; unpaid rows show what is still owed.
    amountText: view.owedUsdText ?? usd(record.amountDueUsd),
    zigText: view.owedZigText ?? (record.amountDueZig != null ? `≈ ${zig(record.amountDueZig)}` : null),
    details,
  };
}
