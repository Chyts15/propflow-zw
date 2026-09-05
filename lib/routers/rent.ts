import { z } from "zod";
import { router, landlordProcedure, landlordWriteProcedure, tenantProcedure } from "@/lib/trpc";
import {
  getRentRecordsForOrg,
  getRentHistoryForTenant,
  getRentLedgerStats,
  markRentRecordPaid,
  setManualExchangeRate,
  submitPaymentProofForTenant,
} from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";
import { isR2Configured, createUploadUrl } from "@/lib/storage/r2";

const PAYMENT_METHODS = ["ECOCASH", "ONEMONEY", "INNBUCKS", "BANK_TRANSFER", "CASH_USD", "CASH_ZIG"] as const;
const ECOCASH_REF = /^EC\d{10}$/;
const CONTENT_TYPES = ["image/jpeg", "image/png"] as const;

const periodInput = z.object({
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodYear: z.number().int().optional(),
});

export const rentRouter = router({
  ledger: landlordProcedure
    .input(periodInput.extend({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getRentRecordsForOrg(ctx.orgId, input ?? {})),

  stats: landlordProcedure
    .input(z.object({ periodMonth: z.number().int().min(1).max(12), periodYear: z.number().int() }))
    .query(({ ctx, input }) => getRentLedgerStats(ctx.orgId, input.periodMonth, input.periodYear)),

  exchangeRate: landlordProcedure.query(({ ctx }) => resolveExchangeRate(ctx.orgId)),

  setExchangeRate: landlordWriteProcedure
    .input(z.object({ usdToZig: z.number().positive() }))
    .mutation(({ ctx, input }) => setManualExchangeRate(ctx.orgId, input.usdToZig)),

  // Writes a PaymentEvent alongside the RentRecord update — spec: Security §3.
  markPaid: landlordWriteProcedure
    .input(
      z
        .object({
          rentRecordId: z.string().cuid(),
          method: z.enum(PAYMENT_METHODS),
          referenceNo: z.string().max(40).optional(),
          amountUsd: z.number().positive(),
        })
        .superRefine((val, ctx) => {
          if (val.method === "ECOCASH" && !ECOCASH_REF.test(val.referenceNo ?? "")) {
            ctx.addIssue({
              code: "custom",
              path: ["referenceNo"],
              message: "EcoCash reference must be EC followed by 10 digits",
            });
          }
        }),
    )
    .mutation(({ ctx, input }) => markRentRecordPaid(ctx.orgId, ctx.dbUser.id, input)),

  // Tenant reads of their own rent history/proof — never gated by org billing
  // status, including PAST_DUE/CANCELLED (CLAUDE.md § Tier Gating & Tenant Access).
  myHistory: tenantProcedure
    .input(z.object({ cursor: z.string().cuid().optional() }).optional())
    .query(({ ctx, input }) => getRentHistoryForTenant(ctx.dbUser.id, { cursor: input?.cursor })),

  // Spec §7 — tenant submits proof of a payment already made directly to the
  // landlord. Stays PENDING until the landlord confirms via markPaid above.
  submitProof: tenantProcedure
    .input(
      z
        .object({
          rentRecordId: z.string().cuid(),
          method: z.enum(PAYMENT_METHODS),
          referenceNo: z.string().max(40).optional(),
          proofImageUrl: z.string().url(),
        })
        .superRefine((val, ctx) => {
          if (val.method === "ECOCASH" && !ECOCASH_REF.test(val.referenceNo ?? "")) {
            ctx.addIssue({
              code: "custom",
              path: ["referenceNo"],
              message: "EcoCash reference must be EC followed by 10 digits",
            });
          }
        }),
    )
    .mutation(({ ctx, input }) => {
      const { rentRecordId, ...data } = input;
      return submitPaymentProofForTenant(ctx.dbUser.id, rentRecordId, data);
    }),

  // Spec: Security §5 — presigned, validated server-side before issuing.
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
      const ext = input.contentType.split("/")[1];
      const key = `rent-proof/${ctx.dbUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      return createUploadUrl({ key, contentType: input.contentType, contentLength: input.contentLength });
    }),

  // sendReminder (SMS) lands in Step 7 once lib/sms is wired to real routers.
});
