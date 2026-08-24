import { z } from "zod";
import { router, landlordProcedure, tenantProcedure } from "@/lib/trpc";
import { getComplaintsForOrg, getComplaintsForTenant } from "@/lib/db/scoped";

export const complaintsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getComplaintsForOrg(ctx.orgId, { cursor: input?.cursor })),

  // Tenant reads of their own complaints — never gated by org billing status.
  listMine: tenantProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getComplaintsForTenant(ctx.dbUser.id, { cursor: input?.cursor })),

  // Single-step submission form (Step 6) and landlord thread/status updates
  // (Step 6, with SMS side-effects via lib/sms) land once SMS + uploads exist.
});
