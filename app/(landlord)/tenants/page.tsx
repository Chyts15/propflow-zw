import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenanciesForOrg, getVacantUnitsForOrg } from "@/lib/db/scoped";
import { InviteTenantDialog } from "@/components/landlord/invite-tenant-dialog";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function TenantsPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  const [{ items: tenancies }, vacantUnits] = await Promise.all([
    getTenanciesForOrg(orgId),
    getVacantUnitsForOrg(orgId),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-extrabold" style={{ color: t.fg }}>
          Tenants
        </h1>
        <InviteTenantDialog vacantUnits={vacantUnits} />
      </div>

      {tenancies.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No tenants yet
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Invite a tenant onto one of your vacant units.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
          {tenancies.map((tn, i) => (
            <div
              key={tn.id}
              className="flex items-center justify-between px-5 py-4"
              style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: t.fg }}>
                  {tn.tenant.name}
                </p>
                <p className="text-xs" style={{ color: t.fgMuted }}>
                  Unit {tn.unit.unitNumber} · {tn.tenant.email}
                  {tn.tenant.phone && ` · ${tn.tenant.phone}`}
                </p>
              </div>
              <span className="font-mono text-xs" style={{ color: t.fgFaint }}>
                {tn.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
