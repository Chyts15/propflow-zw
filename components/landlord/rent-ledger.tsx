"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { LANDLORD_DARK, PAYMENT_BADGE, RENT_STATUS_BADGE } from "@/components/landlord/theme";
import { MarkPaidDialog } from "@/components/landlord/mark-paid-dialog";
import { ProofBadge } from "@/components/landlord/proof-lightbox";

type Currency = "USD" | "ZIG" | "BOTH";

type RentRow = {
  id: string;
  unit: { unitNumber: string };
  tenantName: string;
  periodMonth: number;
  amountDueUsd: number;
  status: string;
  paymentMethod: string | null;
  proofImageUrl: string | null;
};

type Rate = { usdToZig: number } | null;

function formatDue(periodMonth: number) {
  return `1 ${new Date(2000, periodMonth - 1, 1).toLocaleDateString("en-US", { month: "short" })}`;
}

function AmountCell({ usd, currency, rate }: { usd: number; currency: Currency; rate: Rate }) {
  const zigText = rate ? `ZiG ${Math.round(usd * rate.usdToZig).toLocaleString()}` : "—";
  if (currency === "USD") return <>${usd.toLocaleString()}</>;
  if (currency === "ZIG") return <>{zigText}</>;
  return (
    <>
      ${usd.toLocaleString()} <span className="text-white/40">· {zigText}</span>
    </>
  );
}

export function RentLedger({ records, rate }: { records: RentRow[]; rate: Rate }) {
  const t = LANDLORD_DARK;
  const [currency, setCurrency] = useState<Currency>("USD");
  const [markPaidRow, setMarkPaidRow] = useState<RentRow | null>(null);

  const actionable = (status: string) => status === "PENDING" || status === "OVERDUE" || status === "PARTIAL";

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
              <th className="px-5 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const paymentBadge = r.paymentMethod ? PAYMENT_BADGE[r.paymentMethod] : null;
              const statusBadge = RENT_STATUS_BADGE[r.status];
              const proofPending = !!r.proofImageUrl && r.status !== "PAID";
              return (
                <tr
                  key={r.id}
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
                    {formatDue(r.periodMonth)}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm" style={{ color: t.fg }}>
                    <AmountCell usd={r.amountDueUsd} currency={currency} rate={rate} />
                  </td>
                  <td className="px-5 py-4">
                    {proofPending && r.proofImageUrl ? (
                      <ProofBadge proofImageUrl={r.proofImageUrl} style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }} />
                    ) : paymentBadge ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}
                      >
                        {r.paymentMethod!.replace("_", " ")}
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
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {actionable(r.status) && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setMarkPaidRow(r)}
                          className="rounded-lg px-3 py-1.5 font-mono text-[11px] font-medium text-white"
                          style={{ backgroundColor: t.accentLight }}
                        >
                          MARK PAID
                        </button>
                        {r.status === "OVERDUE" && (
                          <button
                            type="button"
                            disabled
                            title="SMS reminders — Step 7"
                            className="flex h-7 w-7 items-center justify-center rounded-lg opacity-40"
                            style={{ border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
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
          const statusBadge = RENT_STATUS_BADGE[r.status];
          const proofPending = !!r.proofImageUrl && r.status !== "PAID";
          return (
            <div
              key={r.id}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: proofPending ? "rgba(200,82,42,0.1)" : t.cardBg,
                border: `1px solid ${proofPending ? t.accent : t.cardBorder}`,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: t.fg }}>
                    Unit {r.unit.unitNumber}
                  </p>
                  <p className="text-xs" style={{ color: t.fgMuted }}>
                    {r.tenantName} · due {formatDue(r.periodMonth)}
                  </p>
                </div>
                <p className="font-mono text-sm" style={{ color: t.fg }}>
                  <AmountCell usd={r.amountDueUsd} currency={currency} rate={rate} />
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {proofPending && r.proofImageUrl ? (
                  <ProofBadge proofImageUrl={r.proofImageUrl} style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }} />
                ) : paymentBadge ? (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}>
                    {r.paymentMethod!.replace("_", " ")}
                  </span>
                ) : null}
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}>
                  {r.status}
                </span>
              </div>
              {actionable(r.status) && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMarkPaidRow(r)}
                    className="flex-1 rounded-lg py-2 font-mono text-xs font-medium text-white"
                    style={{ backgroundColor: t.accentLight }}
                  >
                    MARK PAID
                  </button>
                  {r.status === "OVERDUE" && (
                    <button
                      type="button"
                      disabled
                      title="SMS reminders — Step 7"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-40"
                      style={{ border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {markPaidRow && (
        <MarkPaidDialog
          rentRecordId={markPaidRow.id}
          unitNumber={markPaidRow.unit.unitNumber}
          amountDueUsd={markPaidRow.amountDueUsd}
          open={!!markPaidRow}
          onOpenChange={(open) => !open && setMarkPaidRow(null)}
        />
      )}
    </div>
  );
}
