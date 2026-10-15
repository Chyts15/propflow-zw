import { Bell } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getOrganization, getUnitCountForOrg, getBillingHistoryForOrg } from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";
import { isFreshPending } from "@/lib/billing-plan";
import { BillingPanel } from "@/components/landlord/billing-panel";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function BillingPage() {
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  // One "now" for the whole render, taken on the server: the panel never reads the clock itself.
  const now = new Date();
  const [org, unitCount, history, rate] = await Promise.all([
    getOrganization(orgId),
    getUnitCountForOrg(orgId),
    getBillingHistoryForOrg(orgId),
    resolveExchangeRate(orgId),
  ]);

  const graceDaysLeft = org.pastDueSince
    ? 7 - Math.floor((now.getTime() - org.pastDueSince.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const historyRows = history.map((h) => ({
    id: h.id,
    type: h.type,
    status: h.status,
    description: h.description,
    amountUsd: h.amountUsd,
    paynowRef: h.paynowRef,
    createdAt: h.createdAt,
    awaiting: isFreshPending(h.status, h.createdAt, now),
  }));

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Billing
        </h1>
        <button
          type="button"
          className="hidden h-9 w-9 items-center justify-center rounded-full sm:flex"
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6">
        <BillingPanel
          org={org}
          unitCount={unitCount}
          history={historyRows}
          graceDaysLeft={graceDaysLeft}
          usdToZig={rate?.usdToZig ?? null}
          now={now}
        />
      </div>
    </div>
  );
}
