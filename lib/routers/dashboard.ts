import { router, landlordProcedure } from "@/lib/trpc";
import { getDashboardStats } from "@/lib/db/scoped";

export const dashboardRouter = router({
  stats: landlordProcedure.query(({ ctx }) => getDashboardStats(ctx.orgId)),
});
