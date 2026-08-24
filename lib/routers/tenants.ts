import { z } from "zod";
import { router, landlordProcedure } from "@/lib/trpc";
import { getTenanciesForOrg } from "@/lib/db/scoped";

export const tenantsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getTenanciesForOrg(ctx.orgId, { cursor: input?.cursor })),

  // Tenant invitation (Clerk invite → Tenancy creation) lands in Step 4 —
  // needs a real Clerk org/invitation flow, not stubbed here.
});
