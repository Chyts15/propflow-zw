import { z } from "zod";
import { router, landlordProcedure, tenantProcedure } from "@/lib/trpc";
import { getRentRecordsForOrg, getRentHistoryForTenant } from "@/lib/db/scoped";

export const rentRouter = router({
  ledger: landlordProcedure
    .input(
      z
        .object({
          cursor: z.string().cuid().optional(),
          periodMonth: z.number().int().min(1).max(12).optional(),
          periodYear: z.number().int().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => getRentRecordsForOrg(ctx.orgId, input ?? {})),

  // Tenant reads of their own rent history/proof — never gated by org billing
  // status, including PAST_DUE/CANCELLED (CLAUDE.md § Tier Gating & Tenant Access).
  myHistory: tenantProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getRentHistoryForTenant(ctx.dbUser.id, { cursor: input?.cursor })),

  // markPaid (writes PaymentEvent), sendReminder (SMS), and proof upload land
  // in Step 5/8 once lib/sms and lib/storage/r2 are wired to real routers.
});
