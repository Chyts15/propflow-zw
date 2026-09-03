"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TENANT_DARK } from "@/components/tenant/theme";

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  PARTIAL: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  PENDING: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  OVERDUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  WAIVED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};

type HistoryRow = {
  id: string;
  periodMonth: number;
  periodYear: number;
  amountDueUsd: number;
  status: string;
  paymentMethod: string | null;
  referenceNo: string | null;
  paidAt: Date | null;
};

export function PaymentHistory({ records }: { records: HistoryRow[] }) {
  const t = TENANT_DARK;
  const [openId, setOpenId] = useState<string | null>(null);

  if (records.length === 0) {
    return (
      <p className="rounded-2xl p-4 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
        No payment history yet.
      </p>
    );
  }

  return (
    <div className="rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      {records.slice(0, 12).map((r, i) => {
        const label = new Date(r.periodYear, r.periodMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const open = openId === r.id;
        const badge = STATUS_BADGE[r.status];
        return (
          <div key={r.id} style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              className="flex w-full items-center justify-between px-4 py-3"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: t.fg }}>
                  {label}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: badge.bg, color: badge.fg }}>
                  {r.status}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: t.fg }}>
                  ${r.amountDueUsd.toLocaleString()}
                </span>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ color: t.fgMuted, transform: open ? "rotate(180deg)" : undefined }}
                />
              </span>
            </button>
            {open && (
              <div className="px-4 pb-3 text-xs" style={{ color: t.fgMuted }}>
                {r.paymentMethod && <p>Method: {r.paymentMethod.replace("_", " ")}</p>}
                {r.referenceNo && <p>Reference: {r.referenceNo}</p>}
                {r.paidAt && <p>Paid: {new Date(r.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>}
                {!r.paymentMethod && !r.paidAt && <p>No payment recorded for this period yet.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
