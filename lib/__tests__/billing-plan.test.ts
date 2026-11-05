import { describe, expect, it } from "vitest";
import { describePlan, isFreshPending, nextPeriodEnd, type OrgBillingState } from "../billing-plan";

const NOW = new Date("2026-10-15T08:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const org = (over: Partial<OrgBillingState> = {}): OrgBillingState => ({
  tier: "STARTER",
  subscriptionStatus: "ACTIVE",
  isAnnual: false,
  currentPeriodEnd: day(10),
  ...over,
});

describe("nextPeriodEnd", () => {
  it("extends from the current end when renewing the same active plan early", () => {
    expect(nextPeriodEnd(org(), "STARTER", false, NOW)).toEqual(day(40));
    expect(nextPeriodEnd(org(), "STARTER", true, NOW)).toEqual(day(375));
  });

  it("starts from now for a first plan, a lapsed plan, or a different plan", () => {
    expect(nextPeriodEnd(org({ tier: "TRIAL", subscriptionStatus: "TRIALING", currentPeriodEnd: null }), "PRO", false, NOW)).toEqual(day(30));
    expect(nextPeriodEnd(org({ currentPeriodEnd: day(-3), subscriptionStatus: "PAST_DUE" }), "STARTER", false, NOW)).toEqual(day(30));
    expect(nextPeriodEnd(org(), "PRO", false, NOW)).toEqual(day(30));
  });

  it("does not extend from a period end that has already passed", () => {
    expect(nextPeriodEnd(org({ currentPeriodEnd: day(-1) }), "STARTER", false, NOW)).toEqual(day(30));
  });
});

describe("describePlan", () => {
  it("says Choose on every card when there is no paid plan yet", () => {
    const trial = org({ tier: "TRIAL", subscriptionStatus: "TRIALING", currentPeriodEnd: null });
    expect(describePlan(trial, "STARTER", false, 7).label).toBe("Choose Starter");
    const expired = org({ tier: "TRIAL", subscriptionStatus: "PAST_DUE", currentPeriodEnd: null });
    expect(describePlan(expired, "PRO", false, 7)).toMatchObject({ kind: "choose", badge: null });
  });

  it("lets an active landlord renew their own plan early, instead of a dead Current plan button", () => {
    expect(describePlan(org(), "STARTER", false, 7)).toMatchObject({ kind: "renew", label: "Renew Starter", badge: "CURRENT PLAN" });
  });

  it("offers monthly to annual on the same tier", () => {
    expect(describePlan(org(), "STARTER", true, 7)).toMatchObject({ kind: "to-annual", label: "Switch to annual" });
    expect(describePlan(org({ isAnnual: true }), "STARTER", false, 7)).toMatchObject({ kind: "to-monthly" });
  });

  it("marks a lapsed plan for reactivation and names up versus down switches", () => {
    expect(describePlan(org({ subscriptionStatus: "PAST_DUE" }), "STARTER", false, 7)).toMatchObject({
      label: "Renew Starter",
      badge: "RENEW TO REACTIVATE",
    });
    expect(describePlan(org(), "PRO", false, 7).label).toBe("Upgrade to Pro");
    expect(describePlan(org({ tier: "PRO" }), "STARTER", false, 7).label).toBe("Switch to Starter");
  });

  it("reports how far over a plan's unit cap the landlord is, without blocking", () => {
    expect(describePlan(org(), "STARTER", false, 12).overBy).toBe(2);
    expect(describePlan(org(), "AGENCY", false, 500).overBy).toBe(0);
  });
});

describe("isFreshPending", () => {
  it("is true only for a recent PENDING payment", () => {
    expect(isFreshPending("PENDING", new Date(NOW.getTime() - 20 * 60_000), NOW)).toBe(true);
    expect(isFreshPending("PENDING", new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe(false);
    expect(isFreshPending("FAILED", NOW, NOW)).toBe(false);
  });
});
