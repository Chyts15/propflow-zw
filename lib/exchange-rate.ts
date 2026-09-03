import "server-only";
import { getLatestExchangeRate } from "@/lib/db/scoped";

// Spec: "There is NO reliable official RBZ API." Strategy is: daily cron
// scrapes RBZ's published rate with a tolerant parser (fails soft), keeps
// the last known rate on failure, marks it stale after 48h, and a landlord's
// manual override always wins. Cache resolved rate in Redis 24h.
//
// What's actually built here: staleness detection and the resolve-for-display
// helper, which is what the ledger/dashboard pill needs. The scrape itself
// (app/api/cron/exchange-rate/route.ts) is NOT built — RBZ publishes its rate
// on a page whose current structure I haven't verified against a live fetch,
// and guessing at a URL/selector would silently break rather than "fail soft"
// the way the spec asks for. Needs a verified target before writing the scraper.

const STALE_AFTER_HOURS = 48;

export type ResolvedExchangeRate = {
  usdToZig: number;
  source: string;
  asOf: Date;
  isStale: boolean;
};

export async function resolveExchangeRate(orgId: string): Promise<ResolvedExchangeRate | null> {
  const rate = await getLatestExchangeRate(orgId);
  if (!rate) return null;

  const hoursOld = (Date.now() - rate.date.getTime()) / (1000 * 60 * 60);
  return {
    usdToZig: rate.usdToZig,
    source: rate.source,
    asOf: rate.date,
    isStale: hoursOld > STALE_AFTER_HOURS,
  };
}

export function usdToZig(usdAmount: number, rate: number) {
  return usdAmount * rate;
}
