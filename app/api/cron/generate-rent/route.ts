import { generateRentRecordsForPeriod } from "@/lib/db/scoped";

// Vercel Cron, monthly on the 1st (see vercel.json). Creates a RentRecord for
// every active Tenancy for the current period, across every org — the
// landlord's "Generate for this period" button (rent.generateForPeriod) is
// the same underlying function scoped to one org, for onboarding mid-month.
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const result = await generateRentRecordsForPeriod(now.getMonth() + 1, now.getFullYear());
  return Response.json(result);
}
