import { z } from "zod";
import { router, landlordProcedure } from "@/lib/trpc";
import { getPropertiesForOrg } from "@/lib/db/scoped";

export const propertiesRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getPropertiesForOrg(ctx.orgId, { cursor: input?.cursor })),
});
