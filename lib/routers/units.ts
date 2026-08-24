import { z } from "zod";
import { router, landlordProcedure } from "@/lib/trpc";
import { getUnitsForOrg } from "@/lib/db/scoped";

export const unitsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getUnitsForOrg(ctx.orgId, { cursor: input?.cursor })),
});
