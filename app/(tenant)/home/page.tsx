import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { MapPin, Plus } from "lucide-react";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getTenancyForTenant, getRentHistoryForTenant, getComplaintsForTenant } from "@/lib/db/scoped";
import { TENANT_DARK, TENANT_FOCUS_RING, COMPLAINT_STATUS_TONE } from "@/components/tenant/theme";
import { TenantRentCard } from "@/components/tenant/rent-card";
import { formatRelativeTime } from "@/lib/utils";
import { formatLongDate } from "@/lib/dates";
import { ymdOf } from "@/lib/rent-timing";
import { COMPLAINT_STATUS_LABEL, buildRentOverview } from "@/lib/tenant-rent-view";

export default async function TenantHomePage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);

  const [tenancy, { items: rentHistory }, { items: complaints }] = await Promise.all([
    getTenancyForTenant(user.id),
    getRentHistoryForTenant(user.id),
    getComplaintsForTenant(user.id),
  ]);

  const t = TENANT_DARK;
  const now = new Date();
  const overview = buildRentOverview(rentHistory, tenancy.rentDueDay, ymdOf(now));

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <p className="font-mono text-xs uppercase tracking-wide" style={{ color: t.fgMuted }}>
        {formatLongDate(now)}
      </p>
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 flex items-start gap-1.5 text-sm" style={{ color: t.fgMuted }}>
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Unit {tenancy.unit.unitNumber} · {tenancy.unit.property.name} · {tenancy.unit.property.suburb}, {tenancy.unit.property.city}
        </span>
      </p>

      <div className="mt-6">
        {overview ? (
          <TenantRentCard view={overview.view} otherUnpaid={overview.otherUnpaid} variant="home" />
        ) : (
          <p className="rounded-2xl p-5 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
            No rent record yet. It will show here once this month&apos;s rent is set up.
          </p>
        )}
      </div>

      <div className="mt-6 flex min-h-11 items-center justify-between">
        <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
          Your complaints
        </h2>
        <Link href="/my-complaints" className={`press flex min-h-11 items-center rounded-lg px-1 font-mono text-xs ${TENANT_FOCUS_RING}`} style={{ color: t.fgMuted }}>
          VIEW ALL →
        </Link>
      </div>
      <div className="mt-1 space-y-2.5">
        {complaints.length === 0 && (
          <p className="rounded-2xl p-4 text-sm" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}>
            No complaints yet.
          </p>
        )}
        {complaints.slice(0, 2).map((c) => (
          <div key={c.id} className="rounded-2xl p-4" style={{ backgroundColor: COMPLAINT_STATUS_TONE[c.status] }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{COMPLAINT_STATUS_LABEL[c.status] ?? "Open"}</p>
              <span className="text-xs text-white/60">{formatRelativeTime(c.createdAt, { short: true })}</span>
            </div>
            <p className="text-sm text-white/85">{c.title}</p>
          </div>
        ))}
      </div>

      <Link
        href="/my-complaints/new"
        className={`press mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg font-mono text-sm font-medium text-white ${TENANT_FOCUS_RING}`}
        style={{ backgroundColor: t.accent }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> REPORT AN ISSUE
      </Link>
    </div>
  );
}
