// Spec: CLAUDE.md § Tier Gating & Tenant Access — TRIAL (30 days, full
// access) | STARTER ≤10 units | PRO ≤40 units | AGENCY unlimited. Shared
// between the server-side enforcement (lib/routers/units.ts) and the
// client-side blur+upgrade UI (components/shared/upgrade-prompt.tsx callers)
// so the numbers never drift apart.
export const TIER_UNIT_CAPS: Record<string, number | null> = {
  TRIAL: null,
  STARTER: 10,
  PRO: 40,
  AGENCY: null,
};

export const TIER_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  STARTER: "Starter",
  PRO: "Pro",
  AGENCY: "Agency",
};

// Spec §5 — Starter $10 / Pro $25 / Agency $99 monthly; annual = 2 months
// free (10x monthly, not 12x). Shared between billing.ts (initiating a
// Paynow payment) and the renewal-warning/receipt emails, so the numbers
// never drift apart.
export const TIER_PRICES: Record<"STARTER" | "PRO" | "AGENCY", number> = {
  STARTER: 10,
  PRO: 25,
  AGENCY: 99,
};

export function unitCapFor(tier: string): number | null {
  return TIER_UNIT_CAPS[tier] ?? null;
}
