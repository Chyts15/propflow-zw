import { expireOverdueTrials } from "@/lib/db/scoped";

// Vercel Cron, daily (see vercel.json). Flips expired unpaid trials to
// PAST_DUE — landlordWriteProcedure (lib/trpc.ts) is what actually enforces
// the 7-day-grace-then-read-only rule; this route never deletes data.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const transitioned = await expireOverdueTrials();
  return Response.json({ transitioned });
}
