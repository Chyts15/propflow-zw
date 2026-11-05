import Link from "next/link";
import { Building2 } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getPropertiesForOrg } from "@/lib/db/scoped";
import { parseCursor } from "@/lib/pagination";
import { occupancySummary } from "@/lib/unit-display";
import { ListPager } from "@/components/landlord/list-pager";
import { AddPropertyDialog } from "@/components/landlord/add-property-dialog";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  // The list is paged: rows past the first page used to be unreachable. The cursor is in the URL.
  const { items: properties, nextCursor } = await getPropertiesForOrg(user.orgId!, { cursor });
  const t = LANDLORD_DARK;
  const firstRun = properties.length === 0 && !cursor;

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Properties
        </h1>
        {/* On a first visit the empty state below carries the one call to action. */}
        {!firstRun && <AddPropertyDialog />}
      </div>

      {properties.length === 0 && cursor ? (
        <p className="mt-8 text-sm" style={{ color: t.fgMuted }}>
          There are no more properties.
        </p>
      ) : firstRun ? (
        <div className="mt-8 rounded-2xl border border-dashed p-6 text-center sm:p-8" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No properties yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: t.fgMuted }}>
            Add your first property, then its units and their rent. After that you can invite your tenants.
          </p>
          <div className="mt-5 flex justify-center">
            <AddPropertyDialog fullLabel />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const occupancy = occupancySummary(p.units);
            return (
              <div
                key={p.id}
                className="relative rounded-2xl p-5 transition hover:brightness-110"
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
                {/* The name link stretches over the whole card; the Add unit link below sits above it. */}
                <p className="font-heading mt-4 text-lg font-extrabold" style={{ color: t.fg }}>
                  <Link
                    href={`/properties/${p.id}`}
                    className={`${FOCUS_RING} rounded after:absolute after:inset-0 after:rounded-2xl`}
                  >
                    {p.name}
                  </Link>
                </p>
                <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
                  {p.suburb}, {p.city}
                </p>
                {occupancy.kind === "empty" ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs" style={{ color: t.fgMuted }}>
                      No units yet
                    </span>
                    <Link
                      href={`/properties/${p.id}?addUnit=1`}
                      className={`${FOCUS_RING} press relative z-10 inline-flex min-h-11 items-center rounded-2xl px-4 font-mono text-xs`}
                      style={{ border: "1px solid rgba(200,82,42,0.4)", color: t.accentLight }}
                    >
                      ADD UNIT →
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex items-center justify-between text-xs" style={{ color: t.fgMuted }}>
                      <span>
                        {occupancy.occupied}/{occupancy.total} occupied
                      </span>
                      <span style={{ color: t.fg }}>{occupancy.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: t.cardBorder }}>
                      <div className="h-full rounded-full" style={{ width: `${occupancy.pct}%`, backgroundColor: t.accent }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ListPager basePath="/properties" cursor={cursor} nextCursor={nextCursor} noun="properties" />
    </div>
  );
}
