import { Bell } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getRentRecordsForOrg, getRentLedgerStats } from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";
import { MonthSelector } from "@/components/landlord/month-selector";
import { RentLedger } from "@/components/landlord/rent-ledger";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  const now = new Date();
  const [yearStr, monthStr] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`).split("-");
  const periodYear = Number(yearStr);
  const periodMonth = Number(monthStr);

  const [stats, { items: records }, rate] = await Promise.all([
    getRentLedgerStats(orgId, periodMonth, periodYear),
    getRentRecordsForOrg(orgId, { periodMonth, periodYear }),
    resolveExchangeRate(orgId),
  ]);

  const statCards = [
    { label: "RECEIVABLE", value: stats.receivable, color: t.fg },
    { label: "COLLECTED", value: stats.collected, color: "#4ade80" },
    { label: "OUTSTANDING", value: stats.outstanding, color: "#fbbf24" },
    { label: "OVERDUE 30+", value: stats.overdue30Plus, color: "#f87171" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Rent Ledger
        </h1>
        <div className="hidden items-center gap-3 sm:flex">
          <MonthSelector value={`${periodYear}-${String(periodMonth).padStart(2, "0")}`} />
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
      <div className="mt-2 sm:hidden">
        <MonthSelector value={`${periodYear}-${String(periodMonth).padStart(2, "0")}`} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <p className="font-mono text-[10px] tracking-wide" style={{ color: t.fgMuted }}>
              {s.label}
            </p>
            <p className="font-heading mt-1 text-xl font-extrabold sm:text-2xl" style={{ color: s.color }}>
              ${s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {records.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No rent records for this period
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Records are generated monthly for each active tenancy.
          </p>
        </div>
      ) : (
        <RentLedger records={records} rate={rate} />
      )}
    </div>
  );
}
