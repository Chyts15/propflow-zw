import { Bell } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getOrganization, getUnitCountForOrg, getBillingHistoryForOrg } from "@/lib/db/scoped";
import { BillingPanel } from "@/components/landlord/billing-panel";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function BillingPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  const [org, unitCount, history] = await Promise.all([
    getOrganization(orgId),
    getUnitCountForOrg(orgId),
    getBillingHistoryForOrg(orgId),
  ]);

  const graceDaysLeft = org.pastDueSince
    ? 7 - Math.floor((new Date().getTime() - org.pastDueSince.getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
        <BillingPanel org={org} unitCount={unitCount} history={history} graceDaysLeft={graceDaysLeft} />
      </div>
    </div>
  );
}
