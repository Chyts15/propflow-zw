import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getPropertiesForOrg } from "@/lib/db/scoped";
import { AddPropertyDialog } from "@/components/landlord/add-property-dialog";
import { EmptyState } from "@/components/shared/error-state";

export default async function PropertiesPage() {
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const { items: properties } = await getPropertiesForOrg(user.orgId!);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-stone-900">Properties</h1>
        <AddPropertyDialog />
      </div>

      {properties.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No properties yet"
          description="Add your first property to start tracking units and rent."
        />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const occupied = p.units.filter((u) => !u.isVacant).length;
            return (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <p className="font-heading text-lg font-extrabold text-stone-900">{p.name}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {p.suburb}, {p.city}
                </p>
                <p className="mt-3 text-xs font-mono text-stone-500">
                  {occupied}/{p.units.length} units occupied
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
