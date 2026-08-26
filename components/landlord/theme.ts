// Dark theme (primary, per PropFlow-ZW-Screens-Overview.pptx) for the
// authenticated landlord shell. Reuses the same near-black terracotta family
// as the portal landing's dark mode for visual continuity.

export const LANDLORD_DARK = {
  sidebarBg: "#150b07",
  mainBg: "#0e0704",
  cardBg: "#1f130d",
  cardBorder: "#3a2216",
  fg: "#ffffff",
  fgMuted: "rgba(255,255,255,0.55)",
  fgFaint: "rgba(255,255,255,0.35)",
  accent: "#c8522a",
  accentLight: "#e8835c",
} as const;

export const PRIORITY_GLOW: Record<string, string> = {
  CRITICAL: "#7a1410",
  HIGH: "#7a2f10",
  MEDIUM: "#7a5a10",
  LOW: "#3a2216",
};

export const PAYMENT_BADGE: Record<string, { bg: string; fg: string }> = {
  ECOCASH: { bg: "rgba(0,168,80,0.18)", fg: "#4ade80" },
  ONEMONEY: { bg: "rgba(227,6,19,0.18)", fg: "#f87171" },
  INNBUCKS: { bg: "rgba(247,168,0,0.18)", fg: "#fbbf24" },
  BANK_TRANSFER: { bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  CASH_USD: { bg: "rgba(255,255,255,0.12)", fg: "#e5e5e5" },
  CASH_ZIG: { bg: "rgba(255,255,255,0.12)", fg: "#e5e5e5" },
};

export const RENT_STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  PARTIAL: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  PENDING: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
  OVERDUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  WAIVED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};
