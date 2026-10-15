"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc-client";
import {
  FOCUS_RING,
  LANDLORD_DARK,
  PAYMENT_BADGE,
  PAYMENT_LABEL,
  RENT_STATUS_BADGE,
  RENT_STATUS_LABEL,
} from "@/components/landlord/theme";
import { MarkPaidDialog, type RecordedPayment } from "@/components/landlord/mark-paid-dialog";
import { UndoPaymentDialog } from "@/components/landlord/undo-payment-dialog";
import { ProofBadge } from "@/components/landlord/proof-lightbox";
import { formatLongDate } from "@/lib/dates";
import { friendlyMessage } from "@/lib/trpc-error";

type Currency = "USD" | "ZIG" | "BOTH";

type RentRow = {
  id: string;
  unit: { unitNumber: string };
  tenantName: string;
  periodMonth: number;
  amountDueUsd: number;
  amountPaidUsd: number;
  balanceUsd: number;
  status: string;
  paymentMethod: string | null;
  referenceNo: string | null;
  proofImageUrl: string | null;
  /** Zimbabwe calendar day the rent fell due, derived (the record has no due-date column). */
  dueYmd: number;
  isOverdue: boolean;
  daysLate: number;
  /** The newest payment still standing, which an undo would take back. */
  lastPayment: { id: string; amountUsd: number; method: string | null; createdAt: Date } | null;
};

type Rate = { usdToZig: number } | null;

const usd = (n: number) => n.toLocaleString("en-US");

function lateText(days: number) {
  return `${days} ${days === 1 ? "day" : "days"} late`;
}

function AmountCell({ usd: amountUsd, currency, rate }: { usd: number; currency: Currency; rate: Rate }) {
  const zigText = rate ? `ZiG ${Math.round(amountUsd * rate.usdToZig).toLocaleString("en-US")}` : "—";
  if (currency === "USD") return <>${usd(amountUsd)}</>;
  if (currency === "ZIG") return <>{zigText}</>;
  return (
    <>
      ${usd(amountUsd)} <span className="text-white/40">· {zigText}</span>
    </>
  );
}

export function RentLedger({ records, rate }: { records: RentRow[]; rate: Rate }) {
  const t = LANDLORD_DARK;
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [markPaidRow, setMarkPaidRow] = useState<RentRow | null>(null);
  const [undoRow, setUndoRow] = useState<RentRow | null>(null);
  // The row whose payment was just recorded or undone: it flashes once so the eye can find it
  // after the page refreshes, then the class is cleared when the animation ends.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flash = (id: string) => ({
    className: flashId === id ? "row-flash" : undefined,
    onAnimationEnd: () => setFlashId((current) => (current === id ? null : current)),
  });

  // Lives here, not in the dialog: the dialog closes on success, and the Undo offered in the toast
  // has to outlive it.
  const undo = trpc.rent.undoPayment.useMutation({
    onSuccess: (_record, variables) => {
      toast.success("Payment undone");
      setFlashId(variables.rentRecordId);
      router.refresh();
    },
    onError: (err) => {
      toast.error(friendlyMessage(err));
      if (err.data?.code === "CONFLICT") router.refresh();
    },
  });

  function handleRecorded(p: RecordedPayment) {
    setFlashId(p.rentRecordId);
    const text =
      p.status === "PAID"
        ? `Unit ${p.unitNumber} marked paid`
        : `$${usd(p.amountUsd)} recorded on Unit ${p.unitNumber}. $${usd(p.remainingUsd)} still owed`;
    toast(
      (tst) => (
        <span className="flex items-center gap-3">
          <span>{text}</span>
          <button
            type="button"
            className="shrink-0 font-mono text-xs font-medium underline underline-offset-2"
            onClick={() => {
              toast.dismiss(tst.id);
              undo.mutate({ rentRecordId: p.rentRecordId, paymentEventId: p.paymentEventId });
            }}
          >
            UNDO
          </button>
        </span>
      ),
      { duration: 8000 },
    );
  }

  const actionable = (status: string) => status === "PENDING" || status === "OVERDUE" || status === "PARTIAL";

  function actions(r: RentRow, layout: "table" | "card") {
    const canRecord = actionable(r.status);
    const lastPayment = r.lastPayment;
    if (!canRecord && !lastPayment) return null;

    const size = layout === "card" ? "min-h-11 px-3" : "px-3 py-2";
    const record = canRecord && (
      <button
        key="record"
        type="button"
        onClick={() => setMarkPaidRow(r)}
        className={`press ${FOCUS_RING} rounded-lg font-mono text-[11px] font-medium text-white ${size} ${layout === "card" ? "flex-1 text-xs" : ""}`}
        style={{ backgroundColor: t.accentLight }}
      >
        {r.status === "PARTIAL" ? "ADD PAYMENT" : "MARK PAID"}
      </button>
    );
    const undoButton = lastPayment && (
      <button
        key="undo"
        type="button"
        onClick={() => setUndoRow(r)}
        aria-label={`Undo the $${usd(lastPayment.amountUsd)} USD payment on unit ${r.unit.unitNumber}`}
        className={`press ${FOCUS_RING} rounded-lg font-mono text-[11px] tabular-nums ${size}`}
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: t.fgMuted }}
      >
        UNDO ${usd(lastPayment.amountUsd)}
      </button>
    );

    return (
      <div className={layout === "card" ? "mt-3 flex items-center gap-2" : "flex items-center justify-end gap-2"}>
        {layout === "card" ? [record, undoButton] : [undoButton, record]}
      </div>
    );
  }

  return (
    <div>
      <div className="mt-2 inline-flex rounded-lg p-1" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        {(["USD", "ZIG", "BOTH"] as Currency[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            disabled={c !== "USD" && !rate}
            className="rounded-md px-3 py-1 font-mono text-xs disabled:opacity-40"
            style={
              currency === c
                ? { backgroundColor: t.accent, color: "#fff" }
                : { color: t.fgMuted }
            }
          >
            {c === "ZIG" ? "ZiG" : c === "BOTH" ? "Both" : "USD"}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-x-auto rounded-2xl sm:block" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        <table className="w-full text-left">
          <thead>
            <tr className="font-mono text-[10px] tracking-wide" style={{ color: t.fgMuted }}>
              <th className="px-5 py-3 font-normal">UNIT / TENANT</th>
              <th className="px-5 py-3 font-normal">DUE</th>
              <th className="px-5 py-3 font-normal">AMOUNT</th>
              <th className="px-5 py-3 font-normal">METHOD</th>
              <th className="px-5 py-3 font-normal">STATUS</th>
              <th className="px-5 py-3 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const paymentBadge = r.paymentMethod ? PAYMENT_BADGE[r.paymentMethod] : null;
              const shownStatus = r.isOverdue ? "OVERDUE" : r.status;
              const statusBadge = RENT_STATUS_BADGE[shownStatus];
              const proofPending = !!r.proofImageUrl && r.status !== "PAID";
              const partlyPaid = r.amountPaidUsd > 0 && r.status !== "PAID";
              return (
                <tr
                  key={r.id}
                  {...flash(r.id)}
                  style={{
                    borderTop: i > 0 ? `1px solid ${t.cardBorder}` : undefined,
                    backgroundColor: proofPending ? "rgba(200,82,42,0.08)" : undefined,
                  }}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold" style={{ color: t.fg }}>
                      Unit {r.unit.unitNumber}
                    </p>
                    <p className="text-xs" style={{ color: t.fgMuted }}>
                      {r.tenantName}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: t.fgMuted }}>
                    {formatLongDate(r.dueYmd)}
                    {r.isOverdue && (
                      <p className="text-xs font-medium tabular-nums" style={{ color: "#f87171" }}>
                        {lateText(r.daysLate)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm tabular-nums" style={{ color: t.fg }}>
                    <AmountCell usd={r.amountDueUsd} currency={currency} rate={rate} />
                    {partlyPaid && (
                      <p className="mt-0.5 text-xs" style={{ color: t.fgMuted }}>
                        ${usd(r.amountPaidUsd)} paid · ${usd(r.balanceUsd)} left
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {proofPending && r.proofImageUrl ? (
                      <ProofBadge proofImageUrl={r.proofImageUrl} style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }} />
                    ) : paymentBadge ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}
                      >
                        {PAYMENT_LABEL[r.paymentMethod!] ?? r.paymentMethod}
                      </span>
                    ) : (
                      <span style={{ color: t.fgFaint }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}
                    >
                      {RENT_STATUS_LABEL[shownStatus] ?? shownStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">{actions(r, "table")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-4 space-y-3 sm:hidden">
        {records.map((r) => {
          const paymentBadge = r.paymentMethod ? PAYMENT_BADGE[r.paymentMethod] : null;
          const shownStatus = r.isOverdue ? "OVERDUE" : r.status;
          const statusBadge = RENT_STATUS_BADGE[shownStatus];
          const proofPending = !!r.proofImageUrl && r.status !== "PAID";
          const partlyPaid = r.amountPaidUsd > 0 && r.status !== "PAID";
          return (
            <div
              key={r.id}
              onAnimationEnd={flash(r.id).onAnimationEnd}
              className={`rounded-2xl p-4 ${flashId === r.id ? "row-flash" : ""}`}
              style={{
                backgroundColor: proofPending ? "rgba(200,82,42,0.1)" : t.cardBg,
                border: `1px solid ${proofPending ? t.accent : t.cardBorder}`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: t.fg }}>
                    Unit {r.unit.unitNumber}
                  </p>
                  <p className="text-xs" style={{ color: t.fgMuted }}>
                    {r.tenantName}
                  </p>
                  <p className="text-xs" style={{ color: t.fgMuted }}>
                    Due {formatLongDate(r.dueYmd)}
                  </p>
                  {r.isOverdue && (
                    <p className="text-xs font-medium tabular-nums" style={{ color: "#f87171" }}>
                      {lateText(r.daysLate)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm tabular-nums" style={{ color: t.fg }}>
                    <AmountCell usd={r.amountDueUsd} currency={currency} rate={rate} />
                  </p>
                  {partlyPaid && (
                    <p className="font-mono text-xs tabular-nums" style={{ color: t.fgMuted }}>
                      ${usd(r.balanceUsd)} left
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {proofPending && r.proofImageUrl ? (
                  <ProofBadge proofImageUrl={r.proofImageUrl} style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }} />
                ) : paymentBadge ? (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}>
                    {PAYMENT_LABEL[r.paymentMethod!] ?? r.paymentMethod}
                  </span>
                ) : null}
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}>
                  {RENT_STATUS_LABEL[shownStatus] ?? shownStatus}
                </span>
              </div>
              {actions(r, "card")}
            </div>
          );
        })}
      </div>

      {markPaidRow && (
        <MarkPaidDialog
          rentRecordId={markPaidRow.id}
          unitNumber={markPaidRow.unit.unitNumber}
          tenantName={markPaidRow.tenantName}
          dueYmd={markPaidRow.dueYmd}
          amountDueUsd={markPaidRow.amountDueUsd}
          amountPaidUsd={markPaidRow.amountPaidUsd}
          usdToZig={rate?.usdToZig ?? null}
          open={!!markPaidRow}
          onOpenChange={(open) => !open && setMarkPaidRow(null)}
          onRecorded={handleRecorded}
          defaultMethod={markPaidRow.paymentMethod as never}
          defaultReferenceNo={markPaidRow.referenceNo}
          proofImageUrl={markPaidRow.proofImageUrl}
        />
      )}

      {undoRow?.lastPayment && (
        <UndoPaymentDialog
          rentRecordId={undoRow.id}
          unitNumber={undoRow.unit.unitNumber}
          amountPaidUsd={undoRow.amountPaidUsd}
          payment={undoRow.lastPayment}
          open
          onOpenChange={(open) => !open && setUndoRow(null)}
          onUndone={setFlashId}
        />
      )}
    </div>
  );
}
