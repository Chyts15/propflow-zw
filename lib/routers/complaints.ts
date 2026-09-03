import { z } from "zod";
import { router, landlordProcedure, tenantProcedure } from "@/lib/trpc";
import {
  getComplaintsForOrg,
  getComplaintsForTenant,
  getComplaintForOrg,
  createComplaintForTenant,
  updateComplaintStatus,
  updateComplaintPriority,
  addComplaintMessageForOrg,
} from "@/lib/db/scoped";
import { isR2Configured, createUploadUrl } from "@/lib/storage/r2";

const STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export const complaintsRouter = router({
  list: landlordProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getComplaintsForOrg(ctx.orgId, { cursor: input?.cursor })),

  byId: landlordProcedure
    .input(z.object({ complaintId: z.string().cuid() }))
    .query(({ ctx, input }) => getComplaintForOrg(ctx.orgId, input.complaintId)),

  updateStatus: landlordProcedure
    .input(z.object({ complaintId: z.string().cuid(), status: z.enum(STATUSES) }))
    .mutation(({ ctx, input }) => updateComplaintStatus(ctx.orgId, input.complaintId, input.status)),

  updatePriority: landlordProcedure
    .input(z.object({ complaintId: z.string().cuid(), priority: z.enum(PRIORITIES) }))
    .mutation(({ ctx, input }) => updateComplaintPriority(ctx.orgId, input.complaintId, input.priority)),

  reply: landlordProcedure
    .input(z.object({ complaintId: z.string().cuid(), body: z.string().min(1).max(2000), imageUrls: z.array(z.string()).max(3).default([]) }))
    .mutation(({ ctx, input }) =>
      addComplaintMessageForOrg(ctx.orgId, input.complaintId, ctx.dbUser.id, "LANDLORD", input.body, input.imageUrls),
    ),

  // Tenant reads of their own complaints — never gated by org billing status.
  listMine: tenantProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getComplaintsForTenant(ctx.dbUser.id, { cursor: input?.cursor })),

  // Single-step submission (spec §8) — up to 3 photos, already-uploaded via
  // getUploadUrl below.
  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        category: z.enum(["Plumbing", "Electrical", "Water/Borehole", "Security", "Structure", "Other"]),
        imageUrls: z.array(z.string()).max(3).default([]),
      }),
    )
    .mutation(({ ctx, input }) => createComplaintForTenant(ctx.dbUser.id, ctx.tenancy.unitId, input)),

  // Spec: Security §5 — presigned URLs only, scoped per user, validated
  // server-side before issuing. Used by the tenant complaint form's photo
  // upload (up to 3 images).
  getUploadUrl: tenantProcedure
    .input(
      z.object({
        contentType: z.enum(CONTENT_TYPES),
        contentLength: z.number().int().positive().max(5 * 1024 * 1024),
      }),
    )
    .mutation(({ ctx, input }) => {
      if (!isR2Configured()) {
        throw new Error("File uploads are not configured yet (R2 credentials missing)");
      }
      const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType.split("/")[1];
      const key = `complaints/${ctx.dbUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      return createUploadUrl({ key, contentType: input.contentType, contentLength: input.contentLength });
    }),
});
