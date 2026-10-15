"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { RENT_TONE, TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";
import type { HistoryRowView } from "@/lib/tenant-rent-view";

// Past months, newest first. Rows are precomputed by buildHistoryRow (lib/tenant-rent-view.ts), so
// this component only handles opening and closing. Each month is its own card instead of a
// divided list (DESIGN.md: no hairline dividers).

export function PaymentHistory({ rows }: { rows: HistoryRowView[] }) {
  const t = TENANT_DARK;
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl p-4 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
        No earlier months yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.slice(0, 12).map((r) => {
        const open = openId === r.id;
        const pill = RENT_TONE[r.tone];
        const panelId = `history-${r.id}`;
        return (
          <div key={r.id} className="rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              aria-expanded={open}
              aria-controls={panelId}
              className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left ${TENANT_FOCUS_RING}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: t.fg }}>
                  {r.periodLabel}
                </span>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: pill.bg, color: pill.fg }}
                >
                  {r.statusLabel}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-right">
                  <span className="block font-mono text-sm" style={{ color: t.fg }}>
                    {r.amountText}
                  </span>
                  {r.zigText && (
                    <span className="block font-mono text-[11px]" style={{ color: t.fgMuted }}>
                      {r.zigText}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className="h-4 w-4 transition-transform motion-reduce:transition-none"
                  aria-hidden="true"
                  style={{ color: t.fgMuted, transform: open ? "rotate(180deg)" : undefined }}
                />
              </span>
            </button>
            {/* The details are always in the page and the row opens by easing its height from 0fr
                to 1fr, which animates the real content height without touching a layout
                property. aria-hidden keeps the closed text out of the reading order. */}
            <div
              id={panelId}
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              aria-hidden={!open}
            >
              <div className="overflow-hidden">
                <div className="space-y-0.5 px-4 pb-3 text-sm" style={{ color: t.fgMuted }}>
                  {r.details.length > 0 ? r.details.map((line) => <p key={line}>{line}</p>) : <p>No payment recorded for this month yet.</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
