// Tenant dark theme (primary), mirroring components/landlord/theme.ts but
// teal-based — matches the tenant half of the portal landing's dark mode.

export const TENANT_DARK = {
  sidebarBg: "#062018",
  mainBg: "#04140f",
  cardBg: "#0e2a20",
  cardBorder: "#1a3d30",
  fg: "#ffffff",
  fgMuted: "rgba(255,255,255,0.55)",
  fgFaint: "rgba(255,255,255,0.35)",
  accent: "#0e7c6b",
  accentLight: "#1aaf97",
} as const;

// Keyboard focus for hand-built controls (inline styles can't express :focus-visible), in the
// tenant's teal. Add the class string next to a control's themed colors.
export const TENANT_FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1aaf97]";

// Rent state pills: hue-matched text on a 15% tint of the same hue (DESIGN.md § Status badges).
export const RENT_TONE: Record<"success" | "warning" | "danger" | "muted", { bg: string; fg: string }> = {
  success: { bg: "rgba(74,222,128,0.15)", fg: "#4ade80" },
  warning: { bg: "rgba(251,191,36,0.15)", fg: "#fbbf24" },
  danger: { bg: "rgba(248,113,113,0.15)", fg: "#f87171" },
  muted: { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.6)" },
};

export const COMPLAINT_STATUS_TONE: Record<string, string> = {
  OPEN: "#7a5a10",
  IN_PROGRESS: "#7a4a10",
  PENDING_PARTS: "#7a4a10",
  RESOLVED: "#0e7c6b",
  CLOSED: "#1a3d30",
};
