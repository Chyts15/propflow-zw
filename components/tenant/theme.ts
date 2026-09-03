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

export const COMPLAINT_STATUS_TONE: Record<string, string> = {
  OPEN: "#7a5a10",
  IN_PROGRESS: "#7a4a10",
  PENDING_PARTS: "#7a4a10",
  RESOLVED: "#0e7c6b",
  CLOSED: "#1a3d30",
};
