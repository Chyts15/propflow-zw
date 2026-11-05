// Subscription rules the billing page and the Paynow activation share, so what the
// landlord is told they will get is computed by the same function that grants it.

import { TIER_LABELS, TIER_PRICES, unitCapFor } from "./tier";

export type PaidTier = "STARTER" | "PRO" | "AGENCY";

export type OrgBillingState = {
  tier: string;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  isAnnual: boolean;
  currentPeriodEnd: Date | null;
};

const DAY_MS = 86_400_000;

/**
 * When a payment of `plan` takes the subscription paid-until. Renewing the same plan while it is
 * still active extends from the current end, so paying early never throws away days already paid
 * for. Anything else (first plan, switching plan, reactivating a lapsed one) starts from now.
 */
export function nextPeriodEnd(org: OrgBillingState, plan: PaidTier, isAnnual: boolean, now: Date): Date {
  const stillActive =
    org.subscriptionStatus === "ACTIVE" &&
    org.tier === plan &&
    org.currentPeriodEnd !== null &&
    org.currentPeriodEnd.getTime() > now.getTime();
  const base = stillActive ? org.currentPeriodEnd!.getTime() : now.getTime();
  return new Date(base + (isAnnual ? 365 : 30) * DAY_MS);
}

export type PlanView = {
  kind: "choose" | "renew" | "upgrade" | "switch" | "to-annual" | "to-monthly";
  /** The action on the button: names what happens, never a generic "Switch plan". */
  label: string;
  badge: "CURRENT PLAN" | "RENEW TO REACTIVATE" | null;
  /** Units beyond this plan's cap; the plan can still be bought, nothing is deleted. */
  overBy: number;
};

export function describePlan(org: OrgBillingState, plan: PaidTier, isAnnual: boolean, unitCount: number): PlanView {
  const name = TIER_LABELS[plan];
  const cap = unitCapFor(plan);
  const overBy = cap === null ? 0 : Math.max(unitCount - cap, 0);

  // No paid plan yet: still on trial, or the trial ended without a payment.
  if (org.tier === "TRIAL" || org.subscriptionStatus === "TRIALING") {
    return { kind: "choose", label: `Choose ${name}`, badge: null, overBy };
  }

  if (org.tier === plan) {
    if (org.subscriptionStatus !== "ACTIVE") {
      return { kind: "renew", label: `Renew ${name}`, badge: "RENEW TO REACTIVATE", overBy };
    }
    if (org.isAnnual !== isAnnual) {
      return {
        kind: isAnnual ? "to-annual" : "to-monthly",
        label: isAnnual ? "Switch to annual" : "Switch to monthly",
        badge: "CURRENT PLAN",
        overBy,
      };
    }
    return { kind: "renew", label: `Renew ${name}`, badge: "CURRENT PLAN", overBy };
  }

  const higher = TIER_PRICES[plan] > TIER_PRICES[org.tier as PaidTier];
  return {
    kind: higher ? "upgrade" : "switch",
    label: higher ? `Upgrade to ${name}` : `Switch to ${name}`,
    badge: null,
    overBy,
  };
}

/** A payment that was started recently enough that Paynow may still be confirming it. */
export const PENDING_FRESH_MS = 2 * 60 * 60 * 1000;

export function isFreshPending(status: string, createdAt: Date, now: Date): boolean {
  return status === "PENDING" && now.getTime() - createdAt.getTime() < PENDING_FRESH_MS;
}
