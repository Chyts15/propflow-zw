import Link from "next/link";
import type { ComponentProps } from "react";
import { AlertTriangle, Bell, MessageSquareWarning } from "lucide-react";
import { CollectionsStat } from "@/components/landlord/collections-stat";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { ExchangeRatePill } from "@/components/shared/exchange-rate-pill";
import {
  LANDLORD_DARK,
  PRIORITY_GLOW,
  PAYMENT_BADGE,
  PAYMENT_LABEL,
  RENT_STATUS_BADGE,
  RENT_STATUS_LABEL,
  COMPLAINT_STATUS_LABEL,
  PRIORITY_LABEL,
} from "@/components/landlord/theme";
import { formatRelativeTime } from "@/lib/utils";

// Presentational half of the landlord dashboard. app/(landlord)/dashboard/page.tsx
// owns auth and data; this takes plain props so it can be rendered from fixtures.

type Stats = {
  totalUnits: number;
  occupiedUnits: number;
  dueUsd: number;
  collectedUsd: number;
  rentRecordCount: number;
  overdueCount: number;
  overdueUsd: number;
  proofsToReview: number;
  onTimeCollectionsPct: number;
  onTimeCollectionsTrend: number | null;
  openComplaints: number;
  criticalComplaints: number;
};

export type DashboardRentRow = {
  id: string;
  unit: { unitNumber: string };
  tenantName: string;
  amountDueUsd: number;
  amountPaidUsd: number;
  status: string;
  paymentMethod: string | null;
  proofImageUrl: string | null;
};

export type DashboardComplaint = {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: Date;
  unit: { unitNumber: string };
  tenantName: string;
};

type Props = {
  greeting: string;
  firstName: string;
  todayLabel: string;
  stats: Stats;
  rentRows: DashboardRentRow[];
  complaints: DashboardComplaint[];
  rate: ComponentProps<typeof ExchangeRatePill>["rate"];
  /** Where the critical banner goes: the complaint itself when there is exactly one, else the list. */
  criticalHref: string;
};

const t = LANDLORD_DARK;

// Hand-built links carry the shared terracotta focus ring; inline styles can't express :focus-visible.
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary-light";
// Section-header links keep their mono look but get a 44px touch target.
const SECTION_LINK = `inline-flex min-h-11 items-center font-mono text-xs ${FOCUS}`;

function compactUsd(amount: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

function zigText(usd: number, usdToZig: number | null) {
  return usdToZig == null ? null : `ZiG ${Math.round(usd * usdToZig).toLocaleString("en-US")}`;
}

function StatTile({
  href,
  label,
  labelCompact,
  value,
  valueCompact,
  valueColor,
  sub,
  subColor,
  extra,
}: {
  href: string;
  label: string;
  labelCompact?: string;
  value: string;
  valueCompact?: string;
  valueColor?: string;
  sub?: string;
  subColor?: string;
  extra?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl p-4 transition hover:brightness-125 ${FOCUS}`}
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
    >
      <p className="font-mono text-[10px] tracking-wide" style={{ color: t.fgMuted }}>
        {labelCompact ? (
          <>
            <span className="sm:hidden">{labelCompact}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </p>
      <p className="font-heading mt-1 text-xl font-extrabold sm:text-2xl" style={{ color: valueColor ?? t.fg }}>
        {valueCompact ? (
          <>
            <span className="sm:hidden">{valueCompact}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: subColor ?? t.fgMuted }}>
          {sub}
        </p>
      )}
      {extra}
    </Link>
  );
}

export function DashboardView({ greeting, firstName, todayLabel, stats, rentRows, complaints, rate, criticalHref }: Props) {
  const usdToZig = rate?.usdToZig ?? null;
  const collectedZig = zigText(stats.collectedUsd, usdToZig);
  const overdueZig = stats.overdueUsd > 0 ? zigText(stats.overdueUsd, usdToZig) : null;
  const fullyCollected = stats.dueUsd > 0 && stats.collectedUsd >= stats.dueUsd;

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            {todayLabel}
          </p>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
            {greeting}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ExchangeRatePill rate={rate} cardBg={t.cardBg} cardBorder={t.cardBorder} fgMuted={t.fgMuted} />
          {/* MobileTopBar already renders a bell on mobile — avoid duplicating it. */}
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stats.criticalComplaints > 0 && (
        <Link
          href={criticalHref}
          className={`mt-6 flex min-h-11 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition hover:brightness-125 ${FOCUS}`}
          style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {stats.criticalComplaints} critical complaint{stats.criticalComplaints > 1 ? "s" : ""} need
            {stats.criticalComplaints === 1 ? "s" : ""} attention
          </span>
          <span className="shrink-0 font-mono text-xs font-medium">VIEW →</span>
        </Link>
      )}

      {/* Side by side only from lg: between sm and lg the 240px sidebar leaves a narrow column,
          and splitting it again squeezed each tile to ~100px and overflowed the amounts. */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CollectionsStat pct={stats.onTimeCollectionsPct} trend={stats.onTimeCollectionsTrend} />
        <div className="grid grid-cols-2 gap-4">
          <StatTile
            href="/finances"
            label="RENT COLLECTED"
            labelCompact="COLLECTED"
            value={`$${stats.collectedUsd.toLocaleString("en-US")}`}
            valueCompact={`$${compactUsd(stats.collectedUsd)}`}
            sub={`of $${stats.dueUsd.toLocaleString("en-US")} due`}
            subColor={fullyCollected ? "#4ade80" : undefined}
            extra={
              collectedZig && (
                <p className="mt-0.5 font-mono text-[11px]" style={{ color: t.fgMuted }}>
                  ≈ {collectedZig}
                </p>
              )
            }
          />
          <StatTile
            href="/finances"
            label="OVERDUE"
            value={`$${stats.overdueUsd.toLocaleString("en-US")}`}
            valueCompact={`$${compactUsd(stats.overdueUsd)}`}
            valueColor={stats.overdueCount > 0 ? "#f87171" : undefined}
            sub={
              stats.rentRecordCount === 0
                ? "no rent generated"
                : stats.overdueCount > 0
                  ? `${stats.overdueCount} unit${stats.overdueCount > 1 ? "s" : ""} overdue`
                  : "none overdue"
            }
            subColor={stats.overdueCount > 0 ? "#f87171" : stats.rentRecordCount > 0 ? "#4ade80" : undefined}
            extra={
              overdueZig && (
                <p className="mt-0.5 font-mono text-[11px]" style={{ color: t.fgMuted }}>
                  ≈ {overdueZig}
                </p>
              )
            }
          />
          <StatTile
            href="/properties"
            label="UNITS"
            value={`${stats.occupiedUnits}/${stats.totalUnits}`}
            sub="occupied"
          />
          <StatTile
            href="/complaints"
            label="OPEN COMPLAINTS"
            labelCompact="COMPLAINTS"
            value={String(stats.openComplaints)}
            sub={stats.criticalComplaints > 0 ? `${stats.criticalComplaints} critical` : undefined}
            subColor="#f87171"
          />
        </div>
      </div>

      {/* Rent first: it is the question a landlord opens this screen to answer, so it
          leads on mobile (single column) and on the left on desktop. */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="rent-status-heading">
          <div className="flex items-center justify-between">
            <h2 id="rent-status-heading" className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
              Rent status
            </h2>
            <Link href="/finances" className={SECTION_LINK} style={{ color: t.fgMuted }}>
              VIEW LEDGER →
            </Link>
          </div>
          {stats.proofsToReview > 0 && (
            <Link
              href="/finances"
              className={`mt-1 flex min-h-11 items-center justify-between gap-3 rounded-2xl px-4 text-sm transition hover:brightness-125 ${FOCUS}`}
              style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }}
            >
              <span>
                {stats.proofsToReview} tenant proof{stats.proofsToReview > 1 ? "s" : ""} waiting for your review
              </span>
              <span className="shrink-0 font-mono text-xs font-medium">REVIEW →</span>
            </Link>
          )}
          <div
            className="mt-2 overflow-hidden rounded-2xl"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
          >
            {rentRows.length === 0 && (
              <p className="p-4 text-sm" style={{ color: t.fgMuted }}>
                No rent records for this period yet.
              </p>
            )}
            {rentRows.map((r, i) => {
              const paymentBadge = r.paymentMethod ? PAYMENT_BADGE[r.paymentMethod] : null;
              const statusBadge = RENT_STATUS_BADGE[r.status];
              const proofPending = !!r.proofImageUrl && r.status !== "PAID";
              const rowZig = usdToZig == null ? null : Math.round(r.amountDueUsd * usdToZig);
              return (
                <Link
                  key={r.id}
                  href="/finances"
                  className={`flex min-h-14 items-start justify-between gap-3 px-4 py-3 transition ${FOCUS} ${
                    proofPending
                      ? "bg-[rgba(200,82,42,0.08)] hover:bg-[rgba(200,82,42,0.16)]"
                      : "hover:bg-white/5"
                  }`}
                  style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm" style={{ color: t.fg }}>
                      <span className="font-semibold">Unit {r.unit.unitNumber}</span>
                      <span style={{ color: t.fgMuted }}> · {r.tenantName}</span>
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: t.fg }}>
                      <CurrencyDisplay usd={r.amountDueUsd} zig={rowZig} />
                      {r.status === "PARTIAL" && (
                        <span className="whitespace-nowrap" style={{ color: t.fgMuted }}> · ${r.amountPaidUsd.toLocaleString("en-US")} paid</span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}
                    >
                      {RENT_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {proofPending ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: PAYMENT_BADGE.INNBUCKS.bg, color: "#fbbf24" }}
                      >
                        Proof uploaded
                      </span>
                    ) : (
                      paymentBadge && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}
                        >
                          {PAYMENT_LABEL[r.paymentMethod!] ?? r.paymentMethod}
                        </span>
                      )
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="complaints-heading">
          <div className="flex items-center justify-between">
            <h2 id="complaints-heading" className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
              Open complaints
            </h2>
            <Link href="/complaints" className={SECTION_LINK} style={{ color: t.fgMuted }}>
              VIEW ALL →
            </Link>
          </div>
          <div className="mt-1 space-y-2.5">
            {complaints.length === 0 && (
              <div
                className="flex items-center gap-2 rounded-2xl p-4 text-sm"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
              >
                <MessageSquareWarning className="h-4 w-4" /> No open complaints.
              </div>
            )}
            {complaints.slice(0, 4).map((c, i) => (
              <Link
                key={c.id}
                href={`/complaints/${c.id}`}
                // Two cards on a phone, four from sm up, so rent stays within reach.
                className={`block rounded-2xl p-4 transition hover:brightness-110 ${FOCUS} ${
                  i >= 2 ? "hidden sm:block" : ""
                }`}
                style={{
                  backgroundColor: PRIORITY_GLOW[c.priority] ?? t.cardBg,
                  boxShadow: `0 0 24px -8px ${PRIORITY_GLOW[c.priority]}`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-white">
                    Unit {c.unit.unitNumber} · {c.tenantName}
                  </p>
                  <span className="shrink-0 text-xs text-white/80">
                    <span className="sm:hidden">{formatRelativeTime(c.createdAt, { short: true })}</span>
                    <span className="hidden sm:inline">{formatRelativeTime(c.createdAt)}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-white/90">{c.title}</p>
                <p className="mt-1.5 font-mono text-[11px] tracking-wide text-white/80">
                  {(PRIORITY_LABEL[c.priority] ?? c.priority).toUpperCase()} ·{" "}
                  {(COMPLAINT_STATUS_LABEL[c.status] ?? c.status).toUpperCase()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
