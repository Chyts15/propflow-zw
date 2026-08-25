import { router } from "@/lib/trpc";
import { propertiesRouter } from "@/lib/routers/properties";
import { unitsRouter } from "@/lib/routers/units";
import { tenantsRouter } from "@/lib/routers/tenants";
import { complaintsRouter } from "@/lib/routers/complaints";
import { rentRouter } from "@/lib/routers/rent";
import { billingRouter } from "@/lib/routers/billing";
import { dashboardRouter } from "@/lib/routers/dashboard";

export const appRouter = router({
  properties: propertiesRouter,
  units: unitsRouter,
  tenants: tenantsRouter,
  complaints: complaintsRouter,
  rent: rentRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
