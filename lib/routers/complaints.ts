import { z } from "zod";
import { router, landlordProcedure, landlordWriteProcedure, tenantProcedure } from "@/lib/trpc";
import {
  getComplaintsForOrg,
  getComplaintsForTenant,
  getComplaintForOrg,
  createComplaintForTenant,
  updateComplaintStatus,
  updateComplaintPriority,
  addComplaintMessageForOrg,
} from "@/lib/db/scoped";
import { TRPCError } from "@trpc/server";
import { isR2Configured, createUploadUrl } from "@/lib/storage/r2";
import { complaintPhotoPrefix, firstForeignPhoto } from "@/lib/storage/upload-url";
import { landlordReplyPhotos } from "@/lib/complaint-photos";
import { CLIENT_CUID } from "@/lib/message-id";
import { SCOPE_QUERY } from "@/lib/complaint-queue";
import { uploadRateLimit } from "@/lib/rate-limit";
import type { ComplaintStatus } from "@/generated/prisma/client";

const STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

export const complaintsRouter = router({
  // The landlord's queue, one feed at a time: ACTIVE (open, in progress, pending parts; most
  // urgent first) or RESOLVED (resolved and closed; most recently touched first). Resolved
  // complaints never share a page with active ones, so they cannot push an open one off page one.
  list: landlordProcedure
    .input(z.object({ scope: z.enum(["ACTIVE", "RESOLVED"]), cursor: z.string().cuid().optional() }))
    .query(({ ctx, input }) => {
      const { statuses, order } = SCOPE_QUERY[input.scope];
      return getComplaintsForOrg(ctx.orgId, { cursor: input.cursor, statuses: statuses as readonly ComplaintStatus[], order });
    }),

  byId: landlordProcedure
    .input(z.object({ complaintId: z.string().cuid() }))
    .query(({ ctx, input }) => getComplaintForOrg(ctx.orgId, input.complaintId)),

  updateStatus: landlordWriteProcedure
    .input(z.object({ complaintId: z.string().cuid(), status: z.enum(STATUSES) }))
    .mutation(({ ctx, input }) => updateComplaintStatus(ctx.orgId, input.complaintId, input.status)),

  updatePriority: landlordWriteProcedure
    .input(z.object({ complaintId: z.string().cuid(), priority: z.enum(PRIORITIES) }))
    .mutation(({ ctx, input }) => updateComplaintPriority(ctx.orgId, input.complaintId, input.priority)),

  reply: landlordWriteProcedure
    // Trimmed first, so a reply of only spaces or line breaks is refused instead of saved.
    // messageId is chosen by the screen once per reply and sent again on a retry, so a reply whose
    // response was lost is saved once (see addComplaintMessageForOrg).
    .input(
      z.object({
        complaintId: z.string().cuid(),
        messageId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        imageUrls: landlordReplyPhotos,
      }),
    )
    .mutation(({ ctx, input }) =>
      addComplaintMessageForOrg(ctx.orgId, input.complaintId, ctx.dbUser.id, "LANDLORD", input.body, input.imageUrls, input.messageId),
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
        // Chosen by the form once per complaint and sent again on a retry (see createComplaintForTenant).
        complaintId: z.string().regex(CLIENT_CUID),
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        category: z.enum(["Plumbing", "Electrical", "Water/Borehole", "Security", "Structure", "Other"]),
        imageUrls: z.array(z.string().url().max(2048)).max(3).default([]),
      }),
    )
    .mutation(({ ctx, input }) => {
      // Only photos this tenant uploaded through getUploadUrl below can be attached: any other
      // address would be loaded by the landlord's screen.
      if (firstForeignPhoto(input.imageUrls, process.env.R2_PUBLIC_URL, complaintPhotoPrefix(ctx.dbUser.id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of the photos wasn't uploaded through PropFlow. Please add it again.",
        });
      }
      const { complaintId, ...fields } = input;
      return createComplaintForTenant(ctx.dbUser.id, ctx.tenancy.unitId, { id: complaintId, ...fields });
    }),

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
    .mutation(async ({ ctx, input }) => {
      if (!isR2Configured()) {
        throw new Error("File uploads are not configured yet (R2 credentials missing)");
      }
      const { success } = await uploadRateLimit(ctx.dbUser.id);
      if (!success) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many uploads — try again later" });
      const ext = input.contentType === "application/pdf" ? "pdf" : input.contentType.split("/")[1];
      const key = `${complaintPhotoPrefix(ctx.dbUser.id)}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      return createUploadUrl({ key, contentType: input.contentType, contentLength: input.contentLength });
    }),
});
