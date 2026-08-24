import { router, landlordProcedure } from "@/lib/trpc";
import { getOrganization } from "@/lib/db/scoped";

export const billingRouter = router({
  status: landlordProcedure.query(({ ctx }) => getOrganization(ctx.orgId)),

  // initiate (Paynow subscription/SMS-bundle purchase) and the hardened
  // webhook land in Step 9 once lib/payments/paynow's hash+re-poll+idempotency
  // flow has a real Paynow merchant account to test against.
});
