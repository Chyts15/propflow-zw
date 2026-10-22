import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateDbUser } from "@/lib/auth/get-or-create-db-user";
import { getTenanciesForOrg, getUnitCountForOrg, getVacantUnitsForOrg } from "@/lib/db/scoped";
import { getPendingInvitesForOrg } from "@/lib/invitations";
import { noInviteReason } from "@/lib/invites";
import { formatLongDate } from "@/lib/dates";
import { parseCursor } from "@/lib/pagination";
import { compareUnitNumbers } from "@/lib/unit-display";
import { ListPager } from "@/components/landlord/list-pager";
import { InviteTenantDialog } from "@/components/landlord/invite-tenant-dialog";
import { PendingInviteActions } from "@/components/landlord/pending-invite-actions";
import { FOCUS_RING, LANDLORD_DARK, RENT_STATUS_BADGE } from "@/components/landlord/theme";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const cursor = parseCursor((await searchParams).cursor);
  const { userId } = await auth();
  const user = await getOrCreateDbUser(userId!);
  const orgId = user.orgId!;
  const t = LANDLORD_DARK;

  // The list is paged: rows past the first page used to be unreachable. The cursor is in the URL.
  const [{ items: tenancies, nextCursor }, vacantUnits, unitCount, pending] = await Promise.all([
    getTenanciesForOrg(orgId, { cursor }),
    getVacantUnitsForOrg(orgId),
    getUnitCountForOrg(orgId),
    getPendingInvitesForOrg(orgId),
  ]);

  // A unit with an invitation waiting is still vacant, but inviting onto it again would race the first.
  const invitedUnitIds = new Set(pending.invites.map((i) => i.unitId));
  const invitable = vacantUnits
    .filter((u) => !invitedUnitIds.has(u.id))
    .sort((a, b) => a.property.name.localeCompare(b.property.name) || compareUnitNumbers(a.unitNumber, b.unitNumber));
  const reason = noInviteReason({ unitCount, vacantCount: vacantUnits.length, pendingCount: pending.invites.length });
  const unavailable =
    reason === null
      ? undefined
      : { reason, ...(unitCount === 0 ? { href: "/properties", hrefLabel: "Go to Properties" } : {}) };

  // Pending invitations belong at the top of the first page only; page 2 is just more tenants.
  const showPending = !cursor && pending.invites.length > 0;
  const firstRun = tenancies.length === 0 && !cursor && !showPending;

  return (
    <div className="mx-auto max-w-6xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
          Tenants
        </h1>
        {/* On a first visit the empty state below carries the one call to action. */}
        {!firstRun && <InviteTenantDialog vacantUnits={invitable} unavailable={unavailable} />}
      </div>

      {pending.unavailable && (
        <p role="status" className="mt-3 text-sm" style={{ color: t.fgMuted }}>
          We couldn&rsquo;t check for pending invitations just now, so an invitation you sent may be missing from this page.
          Reload to try again.
        </p>
      )}

      {pending.truncated && (
        <p role="status" className="mt-3 text-sm" style={{ color: t.fgMuted }}>
          Only the newest pending invitations are shown right now, so an older one may be missing from this page.
        </p>
      )}

      {showPending && (
        <section aria-labelledby="pending-heading" className="mt-6">
          <h2 id="pending-heading" className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            Waiting to accept{" "}
            <span className="font-mono text-sm font-normal" style={{ color: t.fgMuted }}>
              ({pending.invites.length})
            </span>
          </h2>
          <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
            Each tenant was emailed an invitation. They move to the list below once they accept it.
          </p>
          <ul className="mt-3 space-y-2">
            {pending.invites.map((inv) => (
              <li
                key={inv.id}
                className="rounded-2xl p-4 sm:p-5"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium break-words" style={{ color: t.fg }}>
                        {inv.name}
                      </p>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{ backgroundColor: RENT_STATUS_BADGE.PENDING.bg, color: RENT_STATUS_BADGE.PENDING.fg }}
                      >
                        Invitation sent
                      </span>
                    </div>
                    <p className="mt-1 text-xs break-words" style={{ color: t.fgMuted }}>
                      {inv.unitLabel} · {inv.email}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                      Sent {formatLongDate(new Date(inv.invitedAt))}. The link works until {formatLongDate(new Date(inv.expiresAt))}.
                    </p>
                  </div>
                  <PendingInviteActions invite={inv} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tenancies.length === 0 && cursor ? (
        <p className="mt-8 text-sm" style={{ color: t.fgMuted }}>
          There are no more tenants.
        </p>
      ) : firstRun ? (
        <div className="mt-8 rounded-2xl border border-dashed p-6 text-center sm:p-8" style={{ borderColor: t.cardBorder }}>
          <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
            No tenants yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: t.fgMuted }}>
            Invite a tenant onto one of your vacant units. They get an email with a link to set up their free account, and
            upload their payment proof there.
          </p>
          <div className="mt-5 flex justify-center">
            {invitable.length > 0 ? (
              <InviteTenantDialog vacantUnits={invitable} variant="empty" />
            ) : (
              <div className="flex flex-col items-center gap-3">
                {reason && (
                  <p className="max-w-xs text-sm" style={{ color: t.fgMuted }}>
                    {reason}
                  </p>
                )}
                {unitCount === 0 && (
                  <Link
                    href="/properties"
                    className={`${FOCUS_RING} press inline-flex min-h-11 items-center rounded-2xl bg-brand-primary-dark px-5 font-mono text-xs font-medium text-white hover:bg-brand-primary`}
                  >
                    ADD A PROPERTY OR UNIT →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      ) : tenancies.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: t.fgMuted }}>
          No tenants have accepted yet. They appear here as soon as they do.
        </p>
      ) : (
        <>
          {showPending && (
            <h2 className="font-heading mt-8 text-lg font-extrabold" style={{ color: t.fg }}>
              Tenants
            </h2>
          )}
          <ul className="mt-4 space-y-2">
            {tenancies.map((tn) => (
              <li
                key={tn.id}
                className="flex items-center justify-between gap-3 rounded-2xl p-4 sm:p-5"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words" style={{ color: t.fg }}>
                    {tn.tenant.name}
                  </p>
                  <p className="text-xs break-words" style={{ color: t.fgMuted }}>
                    Unit {tn.unit.unitNumber} · {tn.tenant.email}
                    {tn.tenant.phone && ` · ${tn.tenant.phone}`}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs" style={{ color: t.fgFaint }}>
                  {tn.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <ListPager basePath="/tenants" cursor={cursor} nextCursor={nextCursor} noun="tenants" />
    </div>
  );
}
