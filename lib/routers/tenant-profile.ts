import { z } from "zod";
import { router, tenantProcedure } from "@/lib/trpc";
import { setSmsOptInForTenant } from "@/lib/db/scoped";

// The tenant's own settings. Tenant-side, so never gated by the landlord's billing status
// (CLAUDE.md § Tier Gating & Tenant Access).
export const tenantProfileRouter = router({
  setSmsOptIn: tenantProcedure
    .input(z.object({ smsOptIn: z.boolean() }))
    .mutation(({ ctx, input }) => setSmsOptInForTenant(ctx.dbUser.id, input.smsOptIn)),
});
