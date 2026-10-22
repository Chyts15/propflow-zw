import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { getVacantUnitsByIdsForOrg } from "@/lib/db/scoped";
import { clerkErrorCodes, parseInviteMetadata, scanInvitations, toPendingInvites, type InvitationLike, type PendingInvite } from "@/lib/invites";

// Reads a landlord's pending tenant invitations back from Clerk (see lib/invites.ts for why Clerk
// is the source of truth). Clerk lists invitations for the whole instance, not per landlord, so
// the list is filtered by an org-scoped read of the landlord's own vacant units: an invitation
// is only returned if its unit belongs to this org.

const PAGE = 100;
// A hard ceiling on the scan (500 pending invitations across every landlord). Past it, the
// newest invitations are still seen and the oldest are not, and the result says so (`truncated`)
// so the page can tell the landlord; at that size this should move to a table of our own rather
// than a bigger scan.
const MAX_PAGES = 5;

export type PendingInvitesResult = {
  invites: PendingInvite[];
  /** Clerk couldn't be reached: the page renders without the list and says so, rather than failing. */
  unavailable: boolean;
  /** The scan hit its ceiling, so the oldest pending invitations may be missing from `invites`. */
  truncated: boolean;
};

export async function getPendingInvitesForOrg(orgId: string): Promise<PendingInvitesResult> {
  let invitations: InvitationLike[];
  let truncated: boolean;
  try {
    ({ all: invitations, truncated } = await listPendingInvitations());
  } catch (err) {
    // Codes and status only: Clerk's message text can contain the invited email address.
    const status = (err as { status?: unknown } | null)?.status;
    console.error("Clerk pending-invitation list failed", { status, codes: clerkErrorCodes(err) });
    return { invites: [], unavailable: true, truncated: false };
  }

  const unitIds = [
    ...new Set(invitations.map((inv) => parseInviteMetadata(inv.publicMetadata)?.unitId).filter((id): id is string => !!id)),
  ];
  const units = await getVacantUnitsByIdsForOrg(orgId, unitIds);
  const byId = new Map(units.map((u) => [u.id, { unitNumber: u.unitNumber, propertyName: u.property.name }]));
  return { invites: toPendingInvites(invitations, byId, Date.now()), unavailable: false, truncated };
}

async function listPendingInvitations() {
  const client = await clerkClient();
  return scanInvitations(
    (offset, limit) => client.invitations.getInvitationList({ status: "pending", orderBy: "-created_at", limit, offset }),
    { pageSize: PAGE, maxPages: MAX_PAGES },
  );
}
