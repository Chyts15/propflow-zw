import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, Bell, MessageSquareWarning } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  getDashboardStats,
  getComplaintsForOrg,
  getRentRecordsForOrg,
  getLatestExchangeRate,
} from "@/lib/db/scoped";
import { CollectionsStat } from "@/components/landlord/collections-stat";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { LANDLORD_DARK, PRIORITY_GLOW, PAYMENT_BADGE, RENT_STATUS_BADGE } from "@/components/landlord/theme";
import { formatRelativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({
    where: { clerkId: userId! },
    select: { name: true, orgId: true },
  });
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  const [stats, complaints, rentRecords, exchangeRate] = await Promise.all([
    getDashboardStats(orgId),
    getComplaintsForOrg(orgId),
    getRentRecordsForOrg(orgId, {}),
    getLatestExchangeRate(),
  ]);

  const today = new Date()
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            {today}
          </p>
          <h1 className="font-heading text-3xl font-extrabold" style={{ color: t.fg }}>
            Good morning, {user.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {exchangeRate && (
            <span
              className="rounded-full px-3 py-1.5 font-mono text-xs"
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
            >
              1 USD ≈ {exchangeRate.usdToZig.toLocaleString()} ZiG
            </span>
          )}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stats.criticalComplaints > 0 && (
        <div
          className="mt-6 flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
          style={{ backgroundColor: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {stats.criticalComplaints} critical complaint{stats.criticalComplaints > 1 ? "s" : ""} need
            {stats.criticalComplaints === 1 ? "s" : ""} attention
          </span>
          <Link href="/tenants" className="font-mono text-xs font-medium">
            VIEW →
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CollectionsStat pct={stats.onTimeCollectionsPct} trend={stats.onTimeCollectionsTrend} />
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "UNITS", value: `${stats.occupiedUnits}/${stats.totalUnits}`, sub: "occupied" },
            {
              label: "RENT COLLECTED",
              value: `$${stats.collectedUsd.toLocaleString()}`,
              sub: `of $${stats.dueUsd.toLocaleString()} due`,
              subColor: "#4ade80",
            },
            {
              label: "OPEN COMPLAINTS",
              value: String(stats.openComplaints),
              sub: stats.criticalComplaints > 0 ? `${stats.criticalComplaints} critical` : undefined,
              subColor: "#f87171",
            },
            { label: "SMS CREDITS", value: String(stats.smsCredits), sub: "remaining" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
              <p className="font-mono text-[10px] tracking-wide" style={{ color: t.fgMuted }}>
                {s.label}
              </p>
              <p className="font-heading mt-1 text-2xl font-extrabold" style={{ color: t.fg }}>
                {s.value}
              </p>
              {s.sub && (
                <p className="text-xs" style={{ color: s.subColor ?? t.fgMuted }}>
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
              Recent complaints
            </h2>
            <span className="font-mono text-xs" style={{ color: t.fgMuted }}>
              VIEW ALL →
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {complaints.items.length === 0 && (
              <div className="flex items-center gap-2 rounded-2xl p-4 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
                <MessageSquareWarning className="h-4 w-4" /> No complaints yet.
              </div>
            )}
            {complaints.items.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="rounded-2xl p-4"
                style={{ backgroundColor: PRIORITY_GLOW[c.priority] ?? t.cardBg, boxShadow: `0 0 24px -8px ${PRIORITY_GLOW[c.priority]}` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    Unit {c.unit.unitNumber} · {c.title.split(" — ")[0].split(" ").slice(0, 4).join(" ")}
                  </p>
                  <span className="shrink-0 text-xs text-white/60">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-white/80">{c.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
              Rent status
            </h2>
            <span className="font-mono text-xs" style={{ color: t.fgMuted }}>
              VIEW LEDGER →
            </span>
          </div>
          <div className="mt-3 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            {rentRecords.items.length === 0 && (
              <p className="p-4 text-sm" style={{ color: t.fgMuted }}>
                No rent records for this period yet.
              </p>
            )}
            {rentRecords.items.slice(0, 5).map((r, i) => {
              const paymentBadge = r.paymentMethod ? PAYMENT_BADGE[r.paymentMethod] : null;
              const statusBadge = RENT_STATUS_BADGE[r.status];
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
                >
                  <p className="text-sm font-medium" style={{ color: t.fg }}>
                    Unit {r.unit.unitNumber}
                  </p>
                  <div className="flex items-center gap-2">
                    <CurrencyDisplay usd={r.amountDueUsd} />
                    {paymentBadge && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: paymentBadge.bg, color: paymentBadge.fg }}
                      >
                        {r.paymentMethod!.replace("_", " ")}
                      </span>
                    )}
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: statusBadge.bg, color: statusBadge.fg }}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
