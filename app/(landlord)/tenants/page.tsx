import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenanciesForOrg, getVacantUnitsForOrg } from "@/lib/db/scoped";
import { InviteTenantDialog } from "@/components/landlord/invite-tenant-dialog";
import { EmptyState } from "@/components/shared/error-state";

export default async function TenantsPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const orgId = user.orgId!;

  const [{ items: tenancies }, vacantUnits] = await Promise.all([
    getTenanciesForOrg(orgId),
    getVacantUnitsForOrg(orgId),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-stone-900">Tenants</h1>
        <InviteTenantDialog vacantUnits={vacantUnits} />
      </div>

      {tenancies.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No tenants yet"
          description="Invite a tenant onto one of your vacant units."
        />
      ) : (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white shadow-sm">
          {tenancies.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-stone-200" : ""}`}
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{t.tenant.name}</p>
                <p className="text-xs text-stone-500">
                  Unit {t.unit.unitNumber} · {t.tenant.email}
                  {t.tenant.phone && ` · ${t.tenant.phone}`}
                </p>
              </div>
              <span className="font-mono text-xs text-stone-400">
                {t.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
