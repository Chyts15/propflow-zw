import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getDashboardStats, getComplaintsForOrg, getRentStatusPreviewForOrg } from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";
import { ZIMBABWE_TZ, periodOf, ymdOf } from "@/lib/rent-timing";
import { DashboardView } from "@/components/landlord/dashboard-view";

// The complaints a landlord still has to act on — the same set the "open complaints" count uses.
const OPEN_COMPLAINT_STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS"] as const;

// Greeting, date and rent period follow Zimbabwe time, not the server's (UTC on Vercel), so the
// day doesn't read as yesterday between midnight and 02:00 CAT.

function greetingFor(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: ZIMBABWE_TZ }).format(now),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// "MONDAY, 22 JUNE 2026" — the CLAUDE.md date format, set as the mono eyebrow.
function todayLabelFor(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: ZIMBABWE_TZ,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const orgId = user.orgId!;

  const [stats, openComplaints, rentRows, exchangeRate] = await Promise.all([
    getDashboardStats(orgId),
    getComplaintsForOrg(orgId, { statuses: [...OPEN_COMPLAINT_STATUSES] }),
    getRentStatusPreviewForOrg(orgId, 5),
    resolveExchangeRate(orgId),
  ]);

  // Most urgent first (priority desc from the query). A single critical complaint opens
  // its thread directly; several open the list so the landlord picks.
  const complaints = openComplaints.items;
  const criticalOpen = complaints.filter((c) => c.priority === "CRITICAL" && c.status !== "PENDING_PARTS");
  const criticalHref = criticalOpen.length === 1 ? `/complaints/${criticalOpen[0].id}` : "/complaints";

  const now = new Date();
  const { year, month } = periodOf(ymdOf(now));
  const periodLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: ZIMBABWE_TZ }).format(now);
  return (
    <DashboardView
      greeting={greetingFor(now)}
      firstName={user.name.split(" ")[0]}
      todayLabel={todayLabelFor(now)}
      period={{ month, year, label: periodLabel }}
      stats={stats}
      rentRows={rentRows}
      complaints={complaints}
      rate={exchangeRate}
      criticalHref={criticalHref}
    />
  );
}
