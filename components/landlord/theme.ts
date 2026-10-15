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

// Keyboard focus for hand-built controls. Inline styles can't express :focus-visible, so
// links and buttons add this class string next to their themed colors.
// `outline-none` also sets --tw-outline-style to none, and `outline-2` reads that variable, so
// the ring stays invisible unless focus-visible puts the style back to solid.
export const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-brand-primary-light";

// Legacy complaint-card token: one colour used for both the card fill AND its glow, which breaks
// the Decoupled Glow Rule (DESIGN.md). The dashboard cards still read it; complaint screens use
// PRIORITY_FILL and PRIORITY_UNDERGLOW below. Remove once the dashboard has moved over.
export const PRIORITY_GLOW: Record<string, string> = {
  CRITICAL: "#7a1410",
  HIGH: "#7a2f10",
  MEDIUM: "#7a5a10",
  LOW: "#3a2216",
};

// Complaint cards: a dark tonal fill (so white text keeps contrast) and, separately, the colour of
// the underglow. The two are allowed to differ and do: the glow is the brighter hue of the same
// family. Settled (resolved or closed) cards take RESOLVED_CARD_FILL and no glow.
export const PRIORITY_FILL: Record<string, string> = {
  CRITICAL: "#3d1311",
  HIGH: "#3b1f10",
  MEDIUM: "#33270e",
  LOW: "#1f130d",
};

export const PRIORITY_UNDERGLOW: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#3a2216",
};

export const RESOLVED_CARD_FILL = "#1f130d";

// Status and priority pills (hue-matched text on a 15 to 18% tint, per DESIGN.md). Meaning is
// never carried by these colours alone: every use sits next to the word.
export const COMPLAINT_STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  OPEN: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  IN_PROGRESS: { bg: "rgba(96,165,250,0.16)", fg: "#60a5fa" },
  PENDING_PARTS: { bg: "rgba(96,165,250,0.16)", fg: "#60a5fa" },
  RESOLVED: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  CLOSED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.7)" },
};

export const PRIORITY_TONE: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: "rgba(248,113,113,0.16)", fg: "#f87171" },
  HIGH: { bg: "rgba(251,146,60,0.16)", fg: "#fb923c" },
  MEDIUM: { bg: "rgba(236,201,75,0.15)", fg: "#ecc94b" },
  LOW: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.7)" },
};

export const PAYMENT_BADGE: Record<string, { bg: string; fg: string }> = {
  ECOCASH: { bg: "rgba(0,168,80,0.18)", fg: "#4ade80" },
  ONEMONEY: { bg: "rgba(227,6,19,0.18)", fg: "#f87171" },
  INNBUCKS: { bg: "rgba(247,168,0,0.18)", fg: "#fbbf24" },
  BANK_TRANSFER: { bg: "rgba(59,130,246,0.18)", fg: "#60a5fa" },
  CASH_USD: { bg: "rgba(255,255,255,0.12)", fg: "#e5e5e5" },
  CASH_ZIG: { bg: "rgba(255,255,255,0.12)", fg: "#e5e5e5" },
};

// PENDING is amber, not neutral: it is the state a landlord has to act on, and
// the approved comps draw it amber. Neutral is reserved for WAIVED.
export const RENT_STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  PARTIAL: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  PENDING: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  OVERDUE: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  WAIVED: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};

// Human labels for the DB enums, so the UI never prints "ECOCASH" or "PENDING".
export const PAYMENT_LABEL: Record<string, string> = {
  ECOCASH: "EcoCash",
  ONEMONEY: "OneMoney",
  INNBUCKS: "InnBucks",
  BANK_TRANSFER: "Bank transfer",
  CASH_USD: "Cash (USD)",
  CASH_ZIG: "Cash (ZiG)",
};

export const RENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  PENDING: "Pending",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
};

export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  PENDING_PARTS: "Pending parts",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};
