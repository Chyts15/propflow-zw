import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getUnitCountForOrg, getOpenComplaintsCountForOrg, getOrganization } from "@/lib/db/scoped";
import { LandlordSidebar } from "@/components/landlord/sidebar";
import { MobileTopBar, MobileTabBar } from "@/components/landlord/mobile-nav";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // getOrCreateDbUser (not a raw findUnique) — this layout wraps every
  // landlord page, so it runs before any of them get a chance to self-heal
  // a missing User row. Doing the raw lookup here instead would redirect a
  // brand-new landlord to /home before their row (and org) ever gets created.
  const user = await getOrCreateDbUser(userId);
  // Clerk-level auth is UX, not the security boundary (CLAUDE.md § Security
  // First) — this DB check is what actually enforces the role, every time.
  if (user.role !== "LANDLORD" || !user.orgId) redirect("/home");

  const [organization, unitCount, openComplaintsCount] = await Promise.all([
    getOrganization(user.orgId),
    getUnitCountForOrg(user.orgId),
    getOpenComplaintsCountForOrg(user.orgId),
  ]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: LANDLORD_DARK.mainBg }}>
      <LandlordSidebar
        orgName={organization.name}
        userName={user.name}
        tier={organization.tier}
        unitCount={unitCount}
        openComplaintsCount={openComplaintsCount}
      />
      <MobileTopBar />
      <main className="flex-1 overflow-y-auto pt-14 pb-16 sm:pt-0 sm:pb-0">{children}</main>
      <MobileTabBar openComplaintsCount={openComplaintsCount} />
    </div>
  );
}
