import { z } from "zod";
import { router, landlordProcedure, tenantProcedure } from "@/lib/trpc";
import {
  getRentRecordsForOrg,
  getRentHistoryForTenant,
  getRentLedgerStats,
  markRentRecordPaid,
  setManualExchangeRate,
} from "@/lib/db/scoped";
import { resolveExchangeRate } from "@/lib/exchange-rate";

const PAYMENT_METHODS = ["ECOCASH", "ONEMONEY", "INNBUCKS", "BANK_TRANSFER", "CASH_USD", "CASH_ZIG"] as const;
const ECOCASH_REF = /^EC\d{10}$/;

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

  setExchangeRate: landlordProcedure
    .input(z.object({ usdToZig: z.number().positive() }))
    .mutation(({ ctx, input }) => setManualExchangeRate(ctx.orgId, input.usdToZig)),

  // Writes a PaymentEvent alongside the RentRecord update — spec: Security §3.
  markPaid: landlordProcedure
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

  // sendReminder (SMS) and proof upload land in Step 7/8 once lib/sms and
  // lib/storage/r2 are wired to real routers.
});
