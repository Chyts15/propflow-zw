import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getTenanciesForOrg, getVacantUnitsForOrg } from "@/lib/db/scoped";
import { parseCursor } from "@/lib/pagination";
import { ListPager } from "@/components/landlord/list-pager";
import { InviteTenantDialog } from "@/components/landlord/invite-tenant-dialog";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  // The list is paged: rows past the first page used to be unreachable. The cursor is in the URL.
  const [{ items: tenancies, nextCursor }, vacantUnits] = await Promise.all([
    getTenanciesForOrg(orgId, { cursor }),
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

      {tenancies.length === 0 && cursor ? (
        <p className="mt-8 text-sm" style={{ color: t.fgMuted }}>
          There are no more tenants.
        </p>
      ) : tenancies.length === 0 ? (
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

      <ListPager basePath="/tenants" cursor={cursor} nextCursor={nextCursor} noun="tenants" />
    </div>
  );
}
