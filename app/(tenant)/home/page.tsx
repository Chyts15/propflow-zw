import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Bell, MapPin, Upload, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTenancyForTenant, getRentHistoryForTenant, getComplaintsForTenant } from "@/lib/db/scoped";
import { TENANT_DARK, COMPLAINT_STATUS_TONE } from "@/components/tenant/theme";
import { formatRelativeTime } from "@/lib/utils";

const RENT_STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  PARTIAL: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  PENDING: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  OVERDUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  WAIVED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};

export default async function TenantHomePage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! } });

  const [tenancy, { items: rentHistory }, { items: complaints }] = await Promise.all([
    getTenancyForTenant(user.id),
    getRentHistoryForTenant(user.id),
    getComplaintsForTenant(user.id),
  ]);

  const currentRent = rentHistory[0];
  const t = TENANT_DARK;

  const today = new Date()
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();

  const monthLabel = currentRent
    ? new Date(currentRent.periodYear, currentRent.periodMonth - 1, 1).toLocaleDateString("en-US", { month: "long" }).toUpperCase()
    : null;

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            {today}
          </p>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm" style={{ color: t.fgMuted }}>
            <MapPin className="h-3.5 w-3.5" />
            Unit {tenancy.unit.unitNumber} · {tenancy.unit.property.name} · {tenancy.unit.property.suburb},{" "}
            {tenancy.unit.property.city}
          </p>
        </div>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      {currentRent && (
        <div className="mt-6 rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
          <div className="flex items-start justify-between">
            <p className="font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
              {monthLabel} RENT
            </p>
            <button
              type="button"
              disabled
              title="Payment proof upload — Step 8"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-medium opacity-40"
              style={{ border: `1px solid ${t.cardBorder}`, color: t.fg }}
            >
              <Upload className="h-3 w-3" /> UPLOAD PROOF
            </button>
          </div>
          <span
            className="mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: RENT_STATUS_BADGE[currentRent.status].bg,
              color: RENT_STATUS_BADGE[currentRent.status].fg,
            }}
          >
            {currentRent.status}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="font-heading text-4xl font-extrabold" style={{ color: t.fg }}>
              ${currentRent.amountDueUsd.toLocaleString()}
            </p>
            {currentRent.amountDueZig != null && (
              <p className="text-sm" style={{ color: t.fgMuted }}>
                ≈ ZiG {currentRent.amountDueZig.toLocaleString()}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
            Pay your landlord as usual, then upload proof here
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
          Your complaints
        </h2>
        <Link href="/my-complaints" className="font-mono text-xs" style={{ color: t.fgMuted }}>
          VIEW ALL →
        </Link>
      </div>
      <div className="mt-3 space-y-2.5">
        {complaints.length === 0 && (
          <p className="rounded-2xl p-4 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
            No complaints yet.
          </p>
        )}
        {complaints.slice(0, 2).map((c) => (
          <div key={c.id} className="rounded-2xl p-4" style={{ backgroundColor: COMPLAINT_STATUS_TONE[c.status] }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{c.status === "IN_PROGRESS" ? "In progress" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}</p>
              <span className="text-xs text-white/60">{formatRelativeTime(c.createdAt, { short: true })}</span>
            </div>
            <p className="text-sm text-white/85">{c.title}</p>
          </div>
        ))}
      </div>

      <Link
        href="/my-complaints/new"
        className="mt-4 flex items-center justify-center gap-2 rounded-lg py-3 font-mono text-sm font-medium text-white"
        style={{ backgroundColor: t.accent }}
      >
        <Plus className="h-4 w-4" /> REPORT AN ISSUE
      </Link>
    </div>
  );
}
