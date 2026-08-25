import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { router, landlordProcedure } from "@/lib/trpc";
import { getTenanciesForOrg, getVacantUnitForOrg } from "@/lib/db/scoped";

export const tenantsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getTenanciesForOrg(ctx.orgId, { cursor: input?.cursor })),

  // Tenant accounts never self-register — this sends a real Clerk invitation
  // carrying the unit assignment in publicMetadata. lib/webhooks/clerk picks
  // it up on user.created and creates the User + Tenancy rows.
  invite: landlordProcedure
    .input(
      z.object({
        unitId: z.string().cuid(),
        email: z.string().email(),
        name: z.string().min(1).max(200),
        rentDueDay: z.number().int().min(1).max(28).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getVacantUnitForOrg(ctx.orgId, input.unitId);

      const client = await clerkClient();
      return client.invitations.createInvitation({
        emailAddress: input.email,
        redirectUrl: "/sign-up",
        publicMetadata: {
          role: "TENANT",
          unitId: input.unitId,
          name: input.name,
          rentDueDay: input.rentDueDay,
        },
      });
    }),
});
