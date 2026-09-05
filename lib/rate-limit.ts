import "server-only";
import { Redis } from "@upstash/redis";

// Spec: Security §6 — auth-adjacent 10/min per IP, upload-URL issuance
// 20/hour per user, any SMS-triggering endpoint 30/hour per org (SMS-blast
// abuse is a direct financial attack on the landlord's credit balance).

export function isRateLimitConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let redis: Redis | null = null;
function getRedis() {
  if (!isRateLimitConfigured()) return null;
  redis ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redis;
}

export type RateLimitResult = { success: boolean; remaining: number };

async function fixedWindowLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const client = getRedis();
  if (!client) {
    // Upstash isn't configured yet — fail open so local dev isn't blocked;
    // this must never happen in production (see .env.example).
    return { success: true, remaining: limit };
  }
  const windowKey = `${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const count = await client.incr(windowKey);
  if (count === 1) await client.expire(windowKey, windowSeconds);
  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}

export const authRateLimit = (ip: string) => fixedWindowLimit(`ratelimit:auth:${ip}`, 10, 60);
export const uploadRateLimit = (userId: string) => fixedWindowLimit(`ratelimit:upload:${userId}`, 20, 3600);
export const smsRateLimit = (orgId: string) => fixedWindowLimit(`ratelimit:sms:${orgId}`, 30, 3600);

// Webhook idempotency fast-path (spec: Security §2 — "key = Paynow reference,
// stored in Redis 24h"). Not the source of truth: BillingEvent.paynowRef's
// unique constraint + the PENDING-status guard in finalizeBillingEvent is
// what actually makes a replay safe. This just skips the extra Paynow
// re-poll call for a webhook we've already handled in the last 24h.
export async function claimIdempotencyKey(key: string, ttlSeconds = 86400): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // not configured — DB-level guard still protects
  const result = await client.set(key, "1", { nx: true, ex: ttlSeconds });
  return result === "OK";
}
