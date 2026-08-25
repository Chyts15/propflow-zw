import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { getDashboardStats, getComplaintsForOrg, getRentRecordsForOrg } from "@/lib/db/scoped";
import { CollectionsStat } from "@/components/landlord/collections-stat";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { Badge } from "@/components/ui/badge";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-warning/15 text-warning",
  IN_PROGRESS: "bg-info/15 text-info",
  PENDING_PARTS: "bg-info/15 text-info",
  RESOLVED: "bg-success/15 text-success",
  CLOSED: "bg-stone-200 text-stone-600",
};

const RENT_STATUS_COLOR: Record<string, string> = {
  PAID: "bg-success/15 text-success",
  PARTIAL: "bg-warning/15 text-warning",
  PENDING: "bg-stone-200 text-stone-600",
  OVERDUE: "bg-danger/15 text-danger",
  WAIVED: "bg-stone-200 text-stone-600",
};

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { id: true, name: true, orgId: true } });
  const orgId = user.orgId!;

  const [stats, complaints, rentRecords] = await Promise.all([
    getDashboardStats(orgId),
    getComplaintsForOrg(orgId),
    getRentRecordsForOrg(orgId, {}),
  ]);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl text-stone-900">Good morning, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-stone-600">
            {stats.orgName} · {today}
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      {stats.criticalComplaints > 0 && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stats.criticalComplaints} critical complaint{stats.criticalComplaints > 1 ? "s" : ""} need
          {stats.criticalComplaints === 1 ? "s" : ""} attention.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CollectionsStat pct={stats.onTimeCollectionsPct} />
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-600">Units</p>
            <p className="font-heading mt-1 text-2xl font-extrabold text-stone-900">
              {stats.occupiedUnits}/{stats.totalUnits}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-600">Open complaints</p>
            <p
              className={`font-heading mt-1 text-2xl font-extrabold ${stats.criticalComplaints > 0 ? "text-danger" : "text-stone-900"}`}
            >
              {stats.openComplaints}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-600">Rent collected this month</p>
            <p className="mt-1 text-lg font-semibold text-stone-900">
              <CurrencyDisplay usd={stats.collectedUsd} /> <span className="text-stone-400">of</span>{" "}
              <CurrencyDisplay usd={stats.dueUsd} />
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-success"
                style={{ width: `${stats.dueUsd === 0 ? 0 : Math.min(100, (stats.collectedUsd / stats.dueUsd) * 100)}%` }}
              />
            </div>
          </div>
          <div className="col-span-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-600">SMS credits remaining</p>
            <p className="font-heading mt-1 text-2xl font-extrabold text-stone-900">{stats.smsCredits}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-heading text-lg font-extrabold text-stone-900">Recent complaints</h2>
          <div className="mt-3 space-y-3">
            {complaints.items.length === 0 && (
              <p className="text-sm text-stone-500">No complaints yet.</p>
            )}
            {complaints.items.slice(0, 5).map((c) => (
              <div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-900">{c.title}</p>
                  <Badge className={STATUS_COLOR[c.status]}>{c.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Unit {c.unit.unitNumber} · {c.priority}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-lg font-extrabold text-stone-900">Rent status</h2>
          <div className="mt-3 space-y-3">
            {rentRecords.items.length === 0 && (
              <p className="text-sm text-stone-500">No rent records for this period yet.</p>
            )}
            {rentRecords.items.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">Unit {r.unit.unitNumber}</p>
                  <p className="text-xs text-stone-500">
                    <CurrencyDisplay usd={r.amountDueUsd} />
                    {r.paymentMethod && ` · ${r.paymentMethod.replace("_", " ")}`}
                  </p>
                </div>
                <Badge className={RENT_STATUS_COLOR[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
