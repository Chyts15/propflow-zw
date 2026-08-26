import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { getPropertyForOrg } from "@/lib/db/scoped";
import { AddUnitDialog } from "@/components/landlord/add-unit-dialog";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { LANDLORD_DARK } from "@/components/landlord/theme";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { userId } = await auth();
  const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: userId! }, select: { orgId: true } });
  const t = LANDLORD_DARK;

  let property;
  try {
    property = await getPropertyForOrg(user.orgId!, propertyId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="font-heading text-3xl font-extrabold" style={{ color: t.fg }}>
        {property.name}
      </h1>
      <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
        {property.address}, {property.suburb}, {property.city}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
          Units
        </h2>
        <AddUnitDialog propertyId={property.id} />
      </div>

      {property.units.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No units yet
          </p>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Add the first unit for this property.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
          {property.units.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center justify-between px-5 py-4"
              style={i > 0 ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: t.fg }}>
                  Unit {u.unitNumber}
                </p>
                <p className="text-xs" style={{ color: t.fgMuted }}>
                  {u.bedrooms} bed · {u.bathrooms} bath
                  {u.rentAmountUsd != null && (
                    <>
                      {" · "}
                      <CurrencyDisplay usd={u.rentAmountUsd} zig={u.rentAmountZig} />
                    </>
                  )}
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={
                  u.isVacant
                    ? { backgroundColor: "rgba(255,255,255,0.1)", color: t.fgMuted }
                    : { backgroundColor: "rgba(74,222,128,0.15)", color: "#4ade80" }
                }
              >
                {u.isVacant ? "Vacant" : "Occupied"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
