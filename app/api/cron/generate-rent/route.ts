import { generateRentRecordsForPeriod } from "@/lib/db/scoped";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";

// Vercel Cron, monthly on the 1st (see vercel.json). Creates a RentRecord for
// every active Tenancy for the current period, across every org — the
// landlord's "Generate for this period" button (rent.generateForPeriod) is
// the same underlying function scoped to one org, for onboarding mid-month.
export const maxDuration = 60;

export async function GET(req: Request) {
  const rejected = rejectUnauthorizedCron(req);
  if (rejected) return rejected;

  const now = new Date();
  const result = await generateRentRecordsForPeriod(now.getMonth() + 1, now.getFullYear());
  return Response.json(result);
}
