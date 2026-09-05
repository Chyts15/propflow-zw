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

export function unitCapFor(tier: string): number | null {
  return TIER_UNIT_CAPS[tier] ?? null;
}
