import Link from "next/link";
import { Building2 } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getPropertiesForOrg } from "@/lib/db/scoped";
import { AddPropertyDialog } from "@/components/landlord/add-property-dialog";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function PropertiesPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const { items: properties } = await getPropertiesForOrg(user.orgId!);
  const t = LANDLORD_DARK;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-extrabold" style={{ color: t.fg }}>
          Properties
        </h1>
        <AddPropertyDialog />
      </div>

      {properties.length === 0 ? (
        <div
          className="mt-8 rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: t.cardBorder }}
        >
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No properties yet
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Add your first property to start tracking units and rent.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const occupied = p.units.filter((u) => !u.isVacant).length;
            const pct = p.units.length === 0 ? 0 : Math.round((occupied / p.units.length) * 100);
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="rounded-2xl p-5 transition hover:brightness-110"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                <div className="flex items-start justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${t.accent}26`, color: t.accentLight }}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[10px]"
                    style={{ border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
                  >
                    {p.primaryCurrency}
                  </span>
                </div>
                <p className="font-heading mt-4 text-lg font-extrabold" style={{ color: t.fg }}>
                  {p.name}
                </p>
                <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
                  {p.suburb}, {p.city}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs" style={{ color: t.fgMuted }}>
                  <span>
                    {occupied}/{p.units.length} occupied
                  </span>
                  <span style={{ color: t.fg }}>{pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: t.cardBorder }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.accent }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
