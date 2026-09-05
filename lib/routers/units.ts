import { z } from "zod";
import { router, landlordProcedure, landlordWriteProcedure } from "@/lib/trpc";
import { getUnitsForOrg, getUnitForOrg, createUnitForOrg, updateUnitForOrg, deleteUnitForOrg } from "@/lib/db/scoped";

const unitInput = z.object({
  unitNumber: z.string().min(1).max(20),
  bedrooms: z.number().int().min(0).max(20).default(1),
  bathrooms: z.number().int().min(0).max(20).default(1),
  rentAmountUsd: z.number().min(0).optional(),
  rentAmountZig: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  description: z.string().max(1000).optional(),
});

export const unitsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getUnitsForOrg(ctx.orgId, { cursor: input?.cursor })),

  byId: landlordProcedure
    .input(z.object({ unitId: z.string().cuid() }))
    .query(({ ctx, input }) => getUnitForOrg(ctx.orgId, input.unitId)),

  create: landlordWriteProcedure
    .input(z.object({ propertyId: z.string().cuid() }).merge(unitInput))
    .mutation(({ ctx, input }) => {
      const { propertyId, ...data } = input;
      return createUnitForOrg(ctx.orgId, propertyId, data);
    }),

  update: landlordWriteProcedure
    .input(z.object({ unitId: z.string().cuid() }).merge(unitInput.partial()))
    .mutation(({ ctx, input }) => {
      const { unitId, ...data } = input;
      return updateUnitForOrg(ctx.orgId, unitId, data);
    }),

  remove: landlordWriteProcedure
    .input(z.object({ unitId: z.string().cuid() }))
    .mutation(({ ctx, input }) => deleteUnitForOrg(ctx.orgId, input.unitId)),
});
