import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { router, landlordProcedure, landlordWriteProcedure } from "@/lib/trpc";
import { getTenanciesForOrg, getVacantUnitForOrg } from "@/lib/db/scoped";
import { getPendingInvitesForOrg } from "@/lib/invitations";
import { INVITE_TTL_DAYS, inviteFailure, resendWaitSeconds, type PendingInvite } from "@/lib/invites";

// A Clerk invitation id looks like "inv_2abc...". Checked before it is used to look anything up.
const invitationId = z.string().regex(/^inv_[A-Za-z0-9]{8,64}$/);

const UNAVAILABLE = "We couldn't check your pending invitations just now. Please try again in a moment.";

/** Sends the invitation email through Clerk. Failures become landlord-safe messages; only codes are logged. */
async function sendInvitation(
  invite: { email: string; name: string; unitId: string; rentDueDay: number },
  { replacingPending }: { replacingPending: boolean },
) {
  const client = await clerkClient();
  try {
    return await client.invitations.createInvitation({
      emailAddress: invite.email,
      redirectUrl: "/sign-up",
      expiresInDays: INVITE_TTL_DAYS,
      notify: true,
      // A resend re-invites an address that already has the invitation being replaced.
      ignoreExisting: replacingPending,
      publicMetadata: {
        role: "TENANT",
        unitId: invite.unitId,
        name: invite.name,
        rentDueDay: invite.rentDueDay,
      },
    });
  } catch (err) {
    const failure = inviteFailure(err);
    // CLAUDE.md § Security First: no PII in logs. Status and Clerk's error codes are enough to diagnose.
    console.error("Clerk invitation creation failed", failure.log);
    throw new TRPCError({ code: failure.trpcCode, message: failure.message, cause: err });
  }
}

async function findPendingInvite(orgId: string, id: string): Promise<PendingInvite> {
  const { invites, unavailable } = await getPendingInvitesForOrg(orgId);
  if (unavailable) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: UNAVAILABLE });
  const invite = invites.find((i) => i.id === id);
  if (!invite) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That invitation is no longer waiting. Refresh the page to see the latest." });
  }
  return invite;
}

export const tenantsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getTenanciesForOrg(ctx.orgId, { cursor: input?.cursor })),

  // Tenant accounts never self-register: this emails a real Clerk invitation carrying the unit
  // assignment in publicMetadata. app/api/webhooks/clerk picks it up on user.created and creates
  // the User + Tenancy rows. The unit stays Vacant until the tenant accepts, so the invitation
  // itself is read back from Clerk (lib/invitations.ts) to show it as pending.
  invite: landlordWriteProcedure
    .input(
      z.object({
        unitId: z.string().cuid(),
        email: z.string().trim().toLowerCase().email().max(254),
        name: z.string().trim().min(1).max(200),
        rentDueDay: z.number().int().min(1).max(28).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getVacantUnitForOrg(ctx.orgId, input.unitId);

      // One live invitation per unit: a second would let two people race for the same tenancy.
      // If Clerk can't be listed we still send, since the webhook keeps the unit from being double-filled.
      const { invites } = await getPendingInvitesForOrg(ctx.orgId);
      const waiting = invites.find((i) => i.unitId === input.unitId);
      if (waiting) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${waiting.name} has already been invited to ${waiting.unitLabel}. Resend or cancel that invitation first.`,
        });
      }

      const sent = await sendInvitation(input, { replacingPending: false });
      return { id: sent.id };
    }),

  // Clerk has no "resend", so this sends a fresh invitation to the same address with the same
  // unit, then cancels the old one. Creating first means a failure leaves the old invitation intact.
  resendInvite: landlordWriteProcedure.input(z.object({ invitationId })).mutation(async ({ ctx, input }) => {
    const invite = await findPendingInvite(ctx.orgId, input.invitationId);

    const wait = resendWaitSeconds(invite.invitedAt, Date.now());
    if (wait > 0) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `That invitation was sent a moment ago. Wait ${wait} seconds before sending it again.`,
      });
    }

    await getVacantUnitForOrg(ctx.orgId, invite.unitId);
    const sent = await sendInvitation(
      { email: invite.email, name: invite.name, unitId: invite.unitId, rentDueDay: invite.rentDueDay },
      { replacingPending: true },
    );

    try {
      const client = await clerkClient();
      await client.invitations.revokeInvitation(invite.id);
    } catch (err) {
      // The tenant can use either link, and the first to be accepted wins. Not worth failing the resend.
      console.error("Clerk invitation revoke after resend failed", { status: (err as { status?: unknown } | null)?.status });
    }
    return { id: sent.id };
  }),

  // Takes back an invitation, e.g. one sent to a mistyped address. The link in the email stops working.
  cancelInvite: landlordWriteProcedure.input(z.object({ invitationId })).mutation(async ({ ctx, input }) => {
    const invite = await findPendingInvite(ctx.orgId, input.invitationId);
    try {
      const client = await clerkClient();
      await client.invitations.revokeInvitation(invite.id);
    } catch (err) {
      console.error("Clerk invitation revoke failed", { status: (err as { status?: unknown } | null)?.status });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "We couldn't cancel that invitation just now. Please try again." });
    }
    return { id: invite.id };
  }),
});
