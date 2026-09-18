import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { router, landlordProcedure, landlordWriteProcedure } from "@/lib/trpc";
import { getTenanciesForOrg, getVacantUnitForOrg } from "@/lib/db/scoped";

// Clerk's top-level Error#message on a failed API call is just a generic
// HTTP status summary (e.g. "Forbidden") — the actual reason is nested in
// its `errors` array. Pull that out without logging the attempted email
// (CLAUDE.md § Security First — no PII in logs).
function clerkErrorDetail(err: unknown): string {
  const errors = (err as { errors?: { code?: string; message?: string; longMessage?: string }[] })?.errors;
  const first = errors?.[0];
  return first?.longMessage || first?.message || (err instanceof Error ? err.message : "Unknown Clerk error");
}

export const tenantsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getTenanciesForOrg(ctx.orgId, { cursor: input?.cursor })),

  // Tenant accounts never self-register — this sends a real Clerk invitation
  // carrying the unit assignment in publicMetadata. lib/webhooks/clerk picks
  // it up on user.created and creates the User + Tenancy rows.
  invite: landlordWriteProcedure
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
      try {
        return await client.invitations.createInvitation({
          emailAddress: input.email,
          redirectUrl: "/sign-up",
          publicMetadata: {
            role: "TENANT",
            unitId: input.unitId,
            name: input.name,
            rentDueDay: input.rentDueDay,
          },
        });
      } catch (err) {
        const detail = clerkErrorDetail(err);
        console.error("Clerk invitation creation failed:", detail);
        throw new TRPCError({ code: "BAD_REQUEST", message: detail, cause: err });
      }
    }),
});
