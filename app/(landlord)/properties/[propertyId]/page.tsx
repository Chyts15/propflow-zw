import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getPropertyForOrg, getOrganization, getUnitCountForOrg } from "@/lib/db/scoped";
import { getPendingInvitesForOrg } from "@/lib/invitations";
import { formatLongDate } from "@/lib/dates";
import { compareUnitNumbers, isJustCreated } from "@/lib/unit-display";
import { AddUnitDialog } from "@/components/landlord/add-unit-dialog";
import { InviteTenantDialog } from "@/components/landlord/invite-tenant-dialog";
import { PendingInviteActions } from "@/components/landlord/pending-invite-actions";
import { CurrencyDisplay } from "@/components/landlord/currency-display";
import { LANDLORD_DARK, RENT_STATUS_BADGE } from "@/components/landlord/theme";
import { unitCapFor, TIER_LABELS } from "@/lib/tier";

const OCCUPIED_PILL = { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" };
const VACANT_PILL = { bg: "rgba(255,255,255,0.1)", fg: LANDLORD_DARK.fgMuted };

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ addUnit?: string }>;
}) {
  const { propertyId } = await params;
  const { addUnit } = await searchParams;
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const t = LANDLORD_DARK;

  let property;
  try {
    property = await getPropertyForOrg(user.orgId!, propertyId);
  } catch (err) {
    if (err instanceof TRPCError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const units = [...property.units].sort((a, b) => compareUnitNumbers(a.unitNumber, b.unitNumber));
  const hasVacant = units.some((u) => u.isVacant);

  // Invitations live in Clerk, and the unit stays Vacant until the tenant accepts, so they are read
  // back here to show "Invited" instead of offering a second invite. Only worth the call if a unit is vacant.
  const [org, unitCount, pending] = await Promise.all([
    getOrganization(user.orgId!),
    getUnitCountForOrg(user.orgId!),
    hasVacant ? getPendingInvitesForOrg(user.orgId!) : Promise.resolve({ invites: [], unavailable: false, truncated: false }),
  ]);
  const pendingByUnit = new Map(pending.invites.map((i) => [i.unitId, i]));

  const cap = unitCapFor(org.tier);
  const atCap = cap !== null && unitCount >= cap;
  const capMessage = atCap ? `Your ${TIER_LABELS[org.tier] ?? org.tier} plan is limited to ${cap} units — upgrade to add more.` : undefined;
  const now = new Date().getTime();

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        {property.name}
      </h1>
      <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
        {property.address}, {property.suburb}, {property.city}
      </p>

      <div className="mt-6 flex items-start justify-between gap-4">
        <h2 className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
          Units
        </h2>
        {/* With no units yet, the empty state below carries the one call to action. */}
        {units.length > 0 && <AddUnitDialog propertyId={property.id} atCap={atCap} capMessage={capMessage} />}
      </div>

      {pending.unavailable && (
        <p role="status" className="mt-3 text-sm" style={{ color: t.fgMuted }}>
          We couldn&rsquo;t check for pending invitations just now, so a unit you have invited may still show as vacant. Reload
          the page to try again.
        </p>
      )}

      {pending.truncated && (
        <p role="status" className="mt-3 text-sm" style={{ color: t.fgMuted }}>
          Only the newest pending invitations are shown right now, so an older one may still show as vacant.
        </p>
      )}

      {units.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed p-6 text-center sm:p-8" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No units yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: t.fgMuted }}>
            Add the first unit of {property.name} with its monthly rent. You can invite its tenant right after.
          </p>
          <div className="mt-5 flex justify-center">
            <AddUnitDialog propertyId={property.id} atCap={atCap} capMessage={capMessage} defaultOpen={addUnit === "1"} fullLabel />
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {units.map((u) => {
            const invite = u.isVacant ? pendingByUnit.get(u.id) : undefined;
            const pill = u.isVacant ? (invite ? RENT_STATUS_BADGE.PENDING : VACANT_PILL) : OCCUPIED_PILL;
            return (
              <li
                key={u.id}
                className={`rounded-2xl p-4 sm:p-5 ${isJustCreated(u.createdAt, now) ? "row-flash" : ""}`}
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: t.fg }}>
                        Unit {u.unitNumber}
                      </p>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: pill.bg, color: pill.fg }}
                      >
                        {u.isVacant ? (invite ? "Invited" : "Vacant") : "Occupied"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                      {u.bedrooms} bed · {u.bathrooms} bath
                      {u.rentAmountUsd != null && (
                        <>
                          {" · "}
                          <CurrencyDisplay usd={u.rentAmountUsd} zig={u.rentAmountZig} />
                        </>
                      )}
                    </p>
                    {invite && (
                      <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                        Invitation emailed to {invite.name} on {formatLongDate(new Date(invite.invitedAt))}. The unit shows as
                        occupied once they accept.
                      </p>
                    )}
                  </div>
                  {invite ? (
                    <PendingInviteActions invite={invite} />
                  ) : u.isVacant ? (
                    <InviteTenantDialog
                      variant="row"
                      lockedUnitId={u.id}
                      vacantUnits={[{ id: u.id, unitNumber: u.unitNumber, property: { name: property.name } }]}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
