import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUnitCountForOrg } from "@/lib/db/scoped";
import { LandlordSidebar } from "@/components/landlord/sidebar";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      name: true,
      role: true,
      orgId: true,
      organization: { select: { name: true, tier: true } },
    },
  });
  // Clerk-level auth is UX, not the security boundary (CLAUDE.md § Security
  // First) — this DB check is what actually enforces the role, every time.
  if (!user || user.role !== "LANDLORD" || !user.orgId) redirect("/home");

  const unitCount = await getUnitCountForOrg(user.orgId);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: LANDLORD_DARK.mainBg }}>
      <LandlordSidebar
        orgName={user.organization?.name ?? ""}
        userName={user.name}
        tier={user.organization?.tier ?? "TRIAL"}
        unitCount={unitCount}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
