import { z } from "zod";
import { router, landlordProcedure } from "@/lib/trpc";
import {
  getPropertiesForOrg,
  getPropertyForOrg,
  createPropertyForOrg,
  updatePropertyForOrg,
  deletePropertyForOrg,
} from "@/lib/db/scoped";

const PROPERTY_TYPES = ["FLAT", "HOUSE", "ROOM", "COTTAGE", "COMMERCIAL", "STAND"] as const;
const CURRENCIES = ["USD", "ZIG"] as const;

const propertyInput = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(300),
  suburb: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  province: z.string().min(1).max(120),
  type: z.enum(PROPERTY_TYPES),
  totalUnits: z.number().int().min(1).max(1000),
  primaryCurrency: z.enum(CURRENCIES).default("USD"),
  description: z.string().max(2000).optional(),
});

export const propertiesRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getPropertiesForOrg(ctx.orgId, { cursor: input?.cursor })),

  byId: landlordProcedure
    .input(z.object({ propertyId: z.string().cuid() }))
    .query(({ ctx, input }) => getPropertyForOrg(ctx.orgId, input.propertyId)),

  create: landlordProcedure
    .input(propertyInput)
    .mutation(({ ctx, input }) => createPropertyForOrg(ctx.orgId, ctx.dbUser.id, input)),

  update: landlordProcedure
    .input(z.object({ propertyId: z.string().cuid() }).merge(propertyInput.partial()))
    .mutation(({ ctx, input }) => {
      const { propertyId, ...data } = input;
      return updatePropertyForOrg(ctx.orgId, propertyId, data);
    }),

  remove: landlordProcedure
    .input(z.object({ propertyId: z.string().cuid() }))
    .mutation(({ ctx, input }) => deletePropertyForOrg(ctx.orgId, input.propertyId)),
});
