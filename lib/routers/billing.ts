import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, landlordProcedure } from "@/lib/trpc";
import { prisma } from "@/lib/db";
import {
  getOrganization,
  getBillingHistoryForOrg,
  createPendingBillingEvent,
  setBillingEventPollUrl,
  finalizeBillingEvent,
} from "@/lib/db/scoped";
import { isPaynowConfigured, initiateSubscriptionPayment } from "@/lib/payments/paynow";

// Spec §5 — Starter $10 / Pro $25 / Agency $99 monthly; annual = 2 months
// free (10x monthly, not 12x).
const TIER_PRICES = { STARTER: 10, PRO: 25, AGENCY: 99 } as const;
const SMS_BUNDLES = {
  "100": { qty: 100, priceUsd: 3 },
  "500": { qty: 500, priceUsd: 12 },
  "2000": { qty: 2000, priceUsd: 40 },
} as const;

const initiateInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SUBSCRIPTION"), tier: z.enum(["STARTER", "PRO", "AGENCY"]), isAnnual: z.boolean() }),
  z.object({ kind: z.literal("SMS_BUNDLE"), bundle: z.enum(["100", "500", "2000"]) }),
]);

export const billingRouter = router({
  status: landlordProcedure.query(({ ctx }) => getOrganization(ctx.orgId)),

  history: landlordProcedure.query(({ ctx }) => getBillingHistoryForOrg(ctx.orgId)),

  // Deliberately stays on landlordProcedure (not landlordWriteProcedure) —
  // paying is how a PAST_DUE org escapes read-only, so this can never itself
  // be blocked by the gate it's meant to lift.
  initiate: landlordProcedure.input(initiateInput).mutation(async ({ ctx, input }) => {
    if (!isPaynowConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Billing payments aren't configured in this environment yet.",
      });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.dbUser.id }, select: { email: true } });

    let amountUsd: number;
    let type: string;
    let description: string;
    let metadata: { tier: "STARTER" | "PRO" | "AGENCY"; isAnnual: boolean } | { smsQty: number };

    if (input.kind === "SUBSCRIPTION") {
      const monthly = TIER_PRICES[input.tier];
      amountUsd = input.isAnnual ? monthly * 10 : monthly;
      type = "SUBSCRIPTION_PAYMENT";
      description = `${input.tier} plan · ${input.isAnnual ? "Annual" : "Monthly"}`;
      metadata = { tier: input.tier, isAnnual: input.isAnnual };
    } else {
      const bundle = SMS_BUNDLES[input.bundle];
      amountUsd = bundle.priceUsd;
      type = "SMS_BUNDLE";
      description = `SMS bundle · ${bundle.qty}`;
      metadata = { smsQty: bundle.qty };
    }

    // Our own reference — the BillingEvent.paynowRef unique constraint is the
    // idempotency anchor the webhook looks up (spec: Security §2).
    const reference = `PF-${ctx.orgId.slice(-8)}-${Date.now()}`;
    const event = await createPendingBillingEvent(ctx.orgId, { type, amountUsd, paynowRef: reference, description, metadata });

    const response = await initiateSubscriptionPayment({
      reference,
      description,
      amountUsd,
      authEmail: user.email,
    });

    if (!response?.success || !response.hasRedirect || !response.redirectUrl) {
      await finalizeBillingEvent(event.id, "FAILED");
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: response?.error?.toString() ?? "Failed to initiate payment with Paynow",
      });
    }

    await setBillingEventPollUrl(event.id, response.pollUrl!.toString());
    return { redirectUrl: response.redirectUrl.toString() };
  }),
});
