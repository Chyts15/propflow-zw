import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { getPropertyForOrg } from "@/lib/db/scoped";
import { AddUnitDialog } from "@/components/landlord/add-unit-dialog";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/error-state";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });

  let property;
  try {
    property = await getPropertyForOrg(user.orgId!, propertyId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl text-stone-900">{property.name}</h1>
      <p className="mt-1 text-sm text-stone-600">
        {property.address}, {property.suburb}, {property.city}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-extrabold text-stone-900">Units</h2>
        <AddUnitDialog propertyId={property.id} />
      </div>

      {property.units.length === 0 ? (
        <EmptyState className="mt-4" title="No units yet" description="Add the first unit for this property." />
      ) : (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white shadow-sm">
          {property.units.map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center justify-between px-5 py-4 ${i > 0 ? "border-t border-stone-200" : ""}`}
            >
              <div>
                <p className="text-sm font-medium text-stone-900">Unit {u.unitNumber}</p>
                <p className="text-xs text-stone-500">
                  {u.bedrooms} bed · {u.bathrooms} bath
                  {u.rentAmountUsd != null && (
                    <>
                      {" · "}
                      <CurrencyDisplay usd={u.rentAmountUsd} zig={u.rentAmountZig} />
                    </>
                  )}
                </p>
              </div>
              <Badge className={u.isVacant ? "bg-stone-200 text-stone-600" : "bg-success/15 text-success"}>
                {u.isVacant ? "Vacant" : "Occupied"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
