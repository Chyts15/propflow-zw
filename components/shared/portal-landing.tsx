"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  Wrench,
  Receipt,
  Megaphone,
  FileText,
  CheckSquare,
  Bell,
  Upload,
  Sun,
  Moon,
  ArrowRight,
} from "lucide-react";

type Side = "landlord" | "tenant";
type Theme = "dark" | "light";

const TICKER_FULL =
  "ECOCASH · ONEMONEY · INNBUCKS  —  1 USD ≈ 42.6 ZIG  —  HARARE · BULAWAYO · MUTARE";
const TICKER_COMPACT = "ECOCASH · ONEMONEY · INNBUCKS  —  1 USD ≈ 42.6 ZIG";

const SIDES: Record<
  Side,
  {
    eyebrowTop: string;
    eyebrowBottom: string;
    title: [string, string];
    statValue: string;
    statLabel: string;
    icons: { icon: typeof Home; label: string }[];
    href: string;
  }
> = {
  landlord: {
    eyebrowTop: "17.8292°S · 31.0522°E",
    eyebrowBottom: "FOR LANDLORDS & AGENCIES",
    title: ["Landlord", "Portal"],
    statValue: "94%",
    statLabel: "ON-TIME COLLECTIONS",
    icons: [
      { icon: Home, label: "Portfolio" },
      { icon: Wrench, label: "Complaints" },
      { icon: Receipt, label: "Rent ledger" },
      { icon: Megaphone, label: "Announcements" },
      { icon: FileText, label: "Documents" },
    ],
    href: "/sign-in",
  },
  tenant: {
    eyebrowTop: "VICTORIA FALLS · ZAMBEZI",
    eyebrowBottom: "FOR TENANTS, INCLUDED FREE",
    title: ["Tenant", "Portal"],
    statValue: "$0",
    statLabel: "COST, EVERY TIER, ALWAYS",
    icons: [
      { icon: CheckSquare, label: "Complaints" },
      { icon: Receipt, label: "Rent status" },
      { icon: Bell, label: "Notices" },
      { icon: Upload, label: "Proof upload" },
      { icon: FileText, label: "Documents" },
    ],
    href: "/sign-in",
  },
};

const BUILDINGS: Record<Side, { left: string; width: number; height: number }[]> = {
  landlord: [
    { left: "6%", width: 40, height: 190 },
    { left: "16%", width: 56, height: 320 },
    { left: "30%", width: 34, height: 140 },
    { left: "40%", width: 44, height: 260 },
    { left: "52%", width: 30, height: 100 },
  ],
  tenant: [
    { left: "10%", width: 34, height: 150 },
    { left: "22%", width: 44, height: 240 },
    { left: "38%", width: 30, height: 110 },
    { left: "76%", width: 40, height: 210 },
    { left: "88%", width: 52, height: 300 },
  ],
};

const THEME: Record<
  Theme,
  {
    ticker: string;
    tickerText: string;
    landlordBg: string;
    tenantBg: string;
    fg: string;
    fgMuted: string;
    cardBg: string;
    ctaBorder: string;
    buildingColor: string;
  }
> = {
  dark: {
    ticker: "#0a0a0a",
    tickerText: "rgba(255,255,255,0.55)",
    landlordBg: "#1c0a05",
    tenantBg: "#04140f",
    fg: "#ffffff",
    fgMuted: "rgba(255,255,255,0.5)",
    cardBg: "#141210",
    ctaBorder: "rgba(255,255,255,0.25)",
    buildingColor: "#ffffff",
  },
  light: {
    ticker: "#faf8f5",
    tickerText: "#5c4a38",
    landlordBg: "#e8c4ab",
    tenantBg: "#b9ddd0",
    fg: "#1a1208",
    fgMuted: "rgba(26,18,8,0.55)",
    cardBg: "#faf8f5",
    ctaBorder: "rgba(26,18,8,0.2)",
    buildingColor: "#1a1208",
  },
};

const ACCENT: Record<Side, { main: string; light: string }> = {
  landlord: { main: "#c8522a", light: "#e8835c" },
  tenant: { main: "#0e7c6b", light: "#1aaf97" },
};

function Skyline({ side, color }: { side: Side; color: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden opacity-[0.14]">
      {BUILDINGS[side].map((b, i) => (
        <div
          key={i}
          className="absolute bottom-0"
          style={{
            left: b.left,
            width: b.width,
            height: b.height,
            backgroundColor: color,
            backgroundImage: `radial-gradient(circle at 4px 4px, ${THEME.dark.landlordBg}99 1.5px, transparent 1.5px)`,
            backgroundSize: "10px 14px",
          }}
        />
      ))}
    </div>
  );
}

function Ticker({ text, theme }: { text: string; theme: Theme }) {
  const t = THEME[theme];
  return (
    <div
      className="flex h-9 items-center justify-center px-4 font-mono text-[11px] tracking-wide"
      style={{ backgroundColor: t.ticker, color: t.tickerText }}
    >
      {text}
    </div>
  );
}

function LogoCard({ theme }: { theme: Theme }) {
  const t = THEME[theme];
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg px-6 py-4 shadow-lg"
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.ctaBorder}` }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill={ACCENT.landlord.main} />
        <path d="M14 3 L25 12 L14 16 L3 12 Z" fill={ACCENT.tenant.main} />
      </svg>
      <p className="text-sm" style={{ color: t.fg }}>
        <span className="font-heading font-extrabold">PropFlow</span>{" "}
        <span className="font-normal" style={{ color: t.fgMuted }}>
          ZW
        </span>
      </p>
    </div>
  );
}

function Footer({ theme }: { theme: Theme }) {
  const t = THEME[theme];
  return (
    <div
      className="flex h-10 items-center justify-between px-4 font-mono text-[10px] tracking-wide"
      style={{ backgroundColor: t.ticker, color: t.tickerText, borderTop: `1px solid ${t.ctaBorder}` }}
    >
      <span>PROPFLOW ZW © 2026</span>
      <a href="/privacy" onClick={(e) => e.stopPropagation()} className="underline underline-offset-2">
        PRIVACY
      </a>
    </div>
  );
}

function PanelContent({
  side,
  theme,
  compact,
}: {
  side: Side;
  theme: Theme;
  compact: boolean;
}) {
  const s = SIDES[side];
  const t = THEME[theme];
  const a = ACCENT[side];

  return (
    <div className="relative z-10 max-w-sm">
      <p className="font-mono text-xs" style={{ color: t.fgMuted }}>
        {s.eyebrowTop}
      </p>
      <p className="mt-1 font-mono text-xs font-bold tracking-wide" style={{ color: a.main }}>
        {s.eyebrowBottom}
      </p>
      <p className="font-heading mt-2 text-4xl font-extrabold leading-[1.05]" style={{ color: t.fg }}>
        {s.title[0]}
        <br />
        {s.title[1]}
      </p>

      <div
        className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2"
        style={{ border: `1px solid ${t.ctaBorder}`, backgroundColor: `${t.fg}0d` }}
      >
        <span className="font-heading text-xl font-extrabold" style={{ color: t.fg }}>
          {s.statValue}
        </span>
        <span className="font-mono text-[10px] tracking-wide" style={{ color: t.fgMuted }}>
          {s.statLabel}
        </span>
        {compact && (
          <span className="ml-2 flex items-center gap-1 font-mono text-[10px]" style={{ color: t.fgMuted }}>
            Tap to open <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>

      {!compact && (
        <>
          <div className="mt-6 grid grid-cols-4 gap-x-6 gap-y-4">
            {s.icons.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ border: `1.5px solid ${a.main}` }}
                >
                  <Icon className="h-4 w-4" style={{ color: a.main }} />
                </span>
                <span className="font-mono text-[10px]" style={{ color: t.fg }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs tracking-wide"
            style={{ border: `1px solid ${t.ctaBorder}`, color: t.fg }}
          >
            [ ENTER PORTAL <ArrowRight className="h-3 w-3" /> ]
          </div>
        </>
      )}
    </div>
  );
}

export function PortalLanding() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("dark");
  const [hovered, setHovered] = useState<Side | null>(null);
  const [floodingTo, setFloodingTo] = useState<Side | null>(null);
  const t = THEME[theme];

  function enter(side: Side) {
    setFloodingTo(side);
    setTimeout(() => router.push(SIDES[side].href), 260);
  }

  function widthFor(side: Side) {
    if (floodingTo) return floodingTo === side ? "100%" : "0%";
    if (!hovered) return "50%";
    return hovered === side ? "55%" : "45%";
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <button
        type="button"
        onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
        className="fixed right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md"
        style={{ backgroundColor: t.cardBg, border: `1px solid ${t.ctaBorder}`, color: t.fg }}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Desktop / tablet */}
      <div className="hidden flex-1 flex-col sm:flex">
        <Ticker text={TICKER_FULL} theme={theme} />
        <div className="relative flex flex-1">
          {(Object.keys(SIDES) as Side[]).map((side) => (
            <motion.button
              key={side}
              type="button"
              onMouseEnter={() => !floodingTo && setHovered(side)}
              onMouseLeave={() => !floodingTo && setHovered(null)}
              onClick={() => enter(side)}
              animate={{ width: widthFor(side) }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="relative flex h-full flex-col items-start justify-center overflow-hidden px-12 text-left"
              style={{ backgroundColor: side === "landlord" ? t.landlordBg : t.tenantBg }}
            >
              <Skyline side={side} color={ACCENT[side].main} />
              <PanelContent side={side} theme={theme} compact={false} />
            </motion.button>
          ))}

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <LogoCard theme={theme} />
          </div>
        </div>
        <Footer theme={theme} />
      </div>

      {/* Mobile: vertical stack, direct tap-to-navigate */}
      <div className="flex min-h-screen flex-col sm:hidden">
        <Ticker text={TICKER_COMPACT} theme={theme} />
        <div className="relative flex flex-1 flex-col">
          {(Object.keys(SIDES) as Side[]).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => enter(side)}
              className="relative flex flex-1 flex-col justify-center overflow-hidden px-6 py-10 text-left"
              style={{ backgroundColor: side === "landlord" ? t.landlordBg : t.tenantBg }}
            >
              <Skyline side={side} color={ACCENT[side].main} />
              <PanelContent side={side} theme={theme} compact />
            </button>
          ))}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <LogoCard theme={theme} />
          </div>
        </div>
        <Footer theme={theme} />
      </div>
    </div>
  );
}
