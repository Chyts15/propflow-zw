import Link from "next/link";
import { CheckCircle2, Info, Upload } from "lucide-react";
import { RENT_TONE, TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";
import type { RentCardView } from "@/lib/tenant-rent-view";

// The tenant's answer to "what do I owe, by when, and did my proof land". Pure presentation:
// every word and number comes from buildRentCardView (lib/tenant-rent-view.ts).

export function TenantRentCard({
  view,
  otherUnpaid,
  variant,
}: {
  view: RentCardView;
  otherUnpaid: number;
  /** "home" adds the Upload action; on the Rent page the upload form sits right below the card. */
  variant: "home" | "rent";
}) {
  const t = TENANT_DARK;
  const pill = RENT_TONE[view.tone];
  const settled = view.state === "PAID" || view.state === "WAIVED";
  const lateOrToday = view.state === "OVERDUE" || view.timingNote === "Due today";

  return (
    <section
      aria-label={`${view.periodLabel} rent`}
      className="rounded-2xl p-5"
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-wide" style={{ color: t.fgMuted }}>
          {view.periodLabel} rent
        </p>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{ backgroundColor: pill.bg, color: pill.fg }}
        >
          {view.statusLabel}
        </span>
      </div>

      {settled ? (
        <p className="mt-3 font-heading text-3xl font-extrabold" style={{ color: t.fg }}>
          {view.state === "PAID" ? "All paid" : "Nothing to pay"}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-heading text-4xl font-extrabold" style={{ color: t.fg }}>
            {/* usd() always ends in " USD"; the code is set small so a long amount still fits 360px. */}
            {view.owedUsdText?.slice(0, -4)}
            <span className="ml-1.5 text-base" style={{ color: t.fgMuted }}>
              USD
            </span>
          </p>
          {view.owedZigText && (
            <p className="font-mono text-sm" style={{ color: t.fgMuted }}>
              {view.owedZigText}
            </p>
          )}
        </div>
      )}

      {view.partPaidText && (
        <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
          {view.partPaidText}
        </p>
      )}

      {(view.dateLine || view.timingNote) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {view.dateLine && (
            <p className="text-sm font-medium" style={{ color: t.fg }}>
              {view.dateLine}
            </p>
          )}
          {view.timingNote && (
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-[11px]"
              style={{
                backgroundColor: lateOrToday ? RENT_TONE[view.state === "OVERDUE" ? "danger" : "warning"].bg : "rgba(255,255,255,0.08)",
                color: lateOrToday ? RENT_TONE[view.state === "OVERDUE" ? "danger" : "warning"].fg : t.fgMuted,
              }}
            >
              {view.timingNote}
            </span>
          )}
        </div>
      )}

      <p className="mt-3 flex items-start gap-2 text-sm" style={{ color: view.proofSent || view.state === "PAID" ? t.accentLight : t.fgMuted }}>
        {view.proofSent || view.state === "PAID" ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{view.proofNote}</span>
      </p>

      {otherUnpaid > 0 && (
        <p className="mt-2 text-sm" style={{ color: t.fgMuted }}>
          {otherUnpaid === 1 ? "1 more month is" : `${otherUnpaid} more months are`} unpaid. See Payment history
          {variant === "home" ? " on the Rent page." : " below."}
        </p>
      )}

      {variant === "home" && view.canUploadProof && (
        <Link
          href="/rent"
          className={`press mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 font-mono text-xs font-medium sm:w-auto sm:inline-flex ${TENANT_FOCUS_RING}`}
          style={
            view.proofSent
              ? { border: `1px solid ${t.cardBorder}`, color: t.fg }
              : { backgroundColor: t.accentLight, color: "#04140f" }
          }
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {view.proofSent ? "SEND A NEW PROOF" : "UPLOAD PROOF"}
        </Link>
      )}
    </section>
  );
}
