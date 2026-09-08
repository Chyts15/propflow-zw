import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, landlordProcedure, landlordWriteProcedure } from "@/lib/trpc";
import {
  getUnitsForOrg,
  getUnitForOrg,
  createUnitForOrg,
  updateUnitForOrg,
  deleteUnitForOrg,
  getOrganization,
  getUnitCountForOrg,
} from "@/lib/db/scoped";
import { unitCapFor, TIER_LABELS } from "@/lib/tier";

const unitInput = z.object({
  unitNumber: z.string().min(1).max(20),
  bedrooms: z.number().int().min(0).max(20).default(1),
  bathrooms: z.number().int().min(0).max(20).default(1),
  // Required (not just present-but-nullable): every amount field in this
  // schema (RentRecord.amountDueUsd, PaymentEvent, BillingEvent) treats USD
  // as canonical, and rent-record generation (generateRentRecordsForPeriod,
  // lib/db/scoped.ts) silently skips a unit with no rentAmountUsd rather
  // than fabricate a figure via the exchange rate — so a unit created
  // without one would never get a rent record and look broken. .partial()
  // below keeps this optional again for update, where leaving it out just
  // means "don't change it."
  rentAmountUsd: z.number().positive(),
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

  // Spec: CLAUDE.md § Tier Gating — Starter ≤10 / Pro ≤40 units. Blocks the
  // specific over-cap create, never touches existing units/data (the UI's
  // blur+upgrade prompt is meant to stop the user before they even get here).
  create: landlordWriteProcedure
    .input(z.object({ propertyId: z.string().cuid() }).merge(unitInput))
    .mutation(async ({ ctx, input }) => {
      const [org, unitCount] = await Promise.all([getOrganization(ctx.orgId), getUnitCountForOrg(ctx.orgId)]);
      const cap = unitCapFor(org.tier);
      if (cap !== null && unitCount >= cap) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Your ${TIER_LABELS[org.tier] ?? org.tier} plan is limited to ${cap} units — upgrade to add more.`,
        });
      }
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
