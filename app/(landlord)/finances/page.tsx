import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { periodOf, ymdOf } from "@/lib/rent-timing";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getRentRecordsForOrg, getRentLedgerStats } from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";
import { parseCursor } from "@/lib/pagination";
import { ListPager } from "@/components/landlord/list-pager";
import { MonthSelector } from "@/components/landlord/month-selector";
import { RentLedger } from "@/components/landlord/rent-ledger";
import { GenerateRentButton } from "@/components/landlord/generate-rent-button";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; cursor?: string }>;
}) {
  const { month, cursor: rawCursor } = await searchParams;
  const cursor = parseCursor(rawCursor);
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  // The current month in Zimbabwe time, not the server's (UTC): for the first two hours of a month
  // in Harare the server clock is still on the old one. A malformed ?month= falls back to it
  // instead of becoming NaN, which used to drop the month filter and list every period.
  const current = periodOf(ymdOf(new Date()));
  const valid = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const periodYear = valid ? Number(month.slice(0, 4)) : current.year;
  const periodMonth = valid ? Number(month.slice(5, 7)) : current.month;

  // The ledger is paged: rows past the first page used to be unreachable while the tiles above
  // still summed them. The cursor is in the URL, next to the month, so a refresh stays on the page.
  const [stats, { items: records, nextCursor }, rate] = await Promise.all([
    getRentLedgerStats(orgId, periodMonth, periodYear),
    getRentRecordsForOrg(orgId, { periodMonth, periodYear, cursor }),
    resolveExchangeRate(orgId),
  ]);

  // Overdue is "as of today" across all months, the same figure the dashboard shows. When part of
  // it belongs to earlier months it is called out with a link, so the units behind the number
  // can always be found even though the table below is one month.
  const earlierLink = stats.oldestOverdue
    ? `/finances?month=${stats.oldestOverdue.year}-${String(stats.oldestOverdue.month).padStart(2, "0")}`
    : null;
  const statCards: { label: string; value: number; color: string; note?: string }[] = [
    { label: "RECEIVABLE", value: stats.receivable, color: t.fg },
    { label: "COLLECTED", value: stats.collected, color: "#4ade80" },
    { label: "OUTSTANDING", value: stats.outstanding, color: "#fbbf24" },
    {
      label: "OVERDUE NOW",
      value: stats.overdueUsd,
      color: "#f87171",
      note:
        stats.overdueUnitCount === 0
          ? "Nobody is late"
          : `${stats.overdueUnitCount} ${stats.overdueUnitCount === 1 ? "unit" : "units"} past due`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="flex items-start justify-between">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Rent Ledger
        </h1>
        <div className="hidden items-center gap-3 sm:flex">
          <MonthSelector value={`${periodYear}-${String(periodMonth).padStart(2, "0")}`} />
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
            <p className="font-heading mt-1 text-xl font-extrabold tabular-nums sm:text-2xl" style={{ color: s.color }}>
              ${s.value.toLocaleString("en-US")}
            </p>
            {s.note && (
              <p className="mt-0.5 text-xs" style={{ color: t.fgMuted }}>
                {s.note}
              </p>
            )}
            {s.label === "OVERDUE NOW" && stats.overdueEarlierUsd > 0 && earlierLink && (
              <Link
                href={earlierLink}
                className={`mt-1 inline-flex min-h-11 items-center text-xs underline underline-offset-2 sm:min-h-0 ${FOCUS_RING}`}
                style={{ color: t.accentLight }}
              >
                ${stats.overdueEarlierUsd.toLocaleString("en-US")} is from earlier months →
              </Link>
            )}
          </div>
        ))}
      </div>

      {records.length === 0 && cursor ? (
        <p className="mt-8 text-sm" style={{ color: t.fgMuted }}>
          There are no more rent records for this month.
        </p>
      ) : records.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No rent records for this period
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Records are generated automatically on the 1st of each month for every active tenancy —
            or generate this period now instead of waiting.
          </p>
          <div className="mt-4 flex justify-center">
            <GenerateRentButton periodMonth={periodMonth} periodYear={periodYear} />
          </div>
        </div>
      ) : (
        <RentLedger records={records} rate={rate} />
      )}

      <ListPager
        basePath="/finances"
        query={{ month: `${periodYear}-${String(periodMonth).padStart(2, "0")}` }}
        cursor={cursor}
        nextCursor={nextCursor}
        noun="rent records"
      />
    </div>
  );
}
