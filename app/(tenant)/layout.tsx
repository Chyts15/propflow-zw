import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTenancyForTenant } from "@/lib/db/scoped";
import { TenantSidebar } from "@/components/tenant/sidebar";
import { TenantMobileTopBar, TenantMobileTabBar } from "@/components/tenant/mobile-nav";
import { TENANT_DARK } from "@/components/tenant/theme";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true, name: true, role: true } });
  if (!user || user.role !== "TENANT") redirect("/dashboard");

  const tenancy = await getTenancyForTenant(user.id);
  const unitLabel = `Unit ${tenancy.unit.unitNumber} · ${tenancy.unit.property.name}`;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: TENANT_DARK.mainBg }}>
      <TenantSidebar tenantName={user.name} unitLabel={unitLabel} />
      <TenantMobileTopBar tenantName={user.name} unitLabel={unitLabel} />
      <main className="flex-1 overflow-y-auto pt-14 pb-16 sm:pt-0 sm:pb-0">{children}</main>
      <TenantMobileTabBar />
    </div>
  );
}
