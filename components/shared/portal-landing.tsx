"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Wrench,
  Receipt,
  Users,
  FileCheck,
  History,
  CheckSquare,
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
      { icon: Users, label: "Tenants" },
      { icon: Receipt, label: "Rent ledger" },
      { icon: FileCheck, label: "Payment proofs" },
      { icon: Wrench, label: "Complaints" },
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
      { icon: Receipt, label: "Rent status" },
      { icon: History, label: "Payment history" },
      { icon: Upload, label: "Proof upload" },
      { icon: CheckSquare, label: "Complaints" },
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

// The arrival is one sequence of about a second, played once: the skylines rise out of the
// ground (landlord side first, then tenant), the copy settles in reading order, and the house
// assembles where the two panels meet. The delays below are the score. CSS drives all of it, so
// it starts at first paint and never waits on hydration (see the motion block in globals.css).
const SIDE_DELAY: Record<Side, number> = { landlord: 0, tenant: 140 };

/** Order and base delay for the CSS entrance classes (--i is the step, --d a base in ms). */
const seq = (step: number, delayMs = 0) => ({ "--i": step, "--d": `${delayMs}ms` }) as CSSProperties;

function Skyline({ side, color }: { side: Side; color: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full overflow-hidden opacity-[0.14]">
      {BUILDINGS[side].map((b, i) => (
        <div
          key={i}
          className="ground-reveal absolute bottom-0"
          style={{
            ...seq(i, SIDE_DELAY[side]),
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
      className="enter-fade flex flex-col items-center gap-1 rounded-lg px-6 py-4 shadow-lg"
      style={{ ...seq(0, 100), backgroundColor: t.cardBg, border: `1px solid ${t.ctaBorder}` }}
    >
      {/* The house assembles: the terracotta body rises into place, then the teal roof drops
          onto it. Landlord and tenant meeting at one record is the whole product. */}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path
          className="enter-up"
          style={seq(0, 350)}
          d="M14 3 L25 12 L25 25 L3 25 L3 12 Z"
          fill={ACCENT.landlord.main}
        />
        <path
          className="enter-drop"
          style={seq(0, 560)}
          d="M14 3 L25 12 L14 16 L3 12 Z"
          fill={ACCENT.tenant.main}
        />
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

// Runs along the bottom edge of the chosen panel from the tap until the next route is ready.
function LoadingSweep({ color }: { color: string }) {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 h-[3px] overflow-hidden">
      <span className="sweep-bar block h-full w-2/5" style={{ backgroundColor: color }} />
    </span>
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
  // The copy starts as the skyline is mid-rise, so the eye has something to land on straight away.
  const base = 140 + SIDE_DELAY[side];

  return (
    <div className="relative z-10 max-w-sm">
      <p className="enter-up font-mono text-xs" style={{ ...seq(0, base), color: t.fgMuted }}>
        {s.eyebrowTop}
      </p>
      <p
        className="enter-up mt-1 font-mono text-xs font-bold tracking-wide"
        style={{ ...seq(1, base), color: a.main }}
      >
        {s.eyebrowBottom}
      </p>
      <p
        className="enter-up font-heading mt-2 text-4xl font-extrabold leading-[1.05]"
        style={{ ...seq(2, base), color: t.fg }}
      >
        {s.title[0]}
        <br />
        {s.title[1]}
      </p>

      <div
        className="enter-up mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2"
        style={{ ...seq(3, base), border: `1px solid ${t.ctaBorder}`, backgroundColor: `${t.fg}0d` }}
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
          <div className="enter-up mt-6 grid grid-cols-4 gap-x-6 gap-y-4" style={seq(4, base)}>
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
            className="enter-up mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs tracking-wide"
            style={{ ...seq(5, base), border: `1px solid ${t.ctaBorder}`, color: t.fg }}
          >
            [ ENTER PORTAL{" "}
            <ArrowRight className="h-3 w-3 transition-[transform,color] duration-200 group-hover:translate-x-1 motion-reduce:transform-none" /> ]
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
  // isPending stays true from the moment navigation starts until the next route is ready, which
  // is exactly how long a visitor on a slow connection is left waiting.
  const [isPending, startTransition] = useTransition();
  const startedNavigation = useRef(false);
  const t = THEME[theme];

  // Both portals lead to sign-in: fetch it while the visitor is still choosing.
  useEffect(() => {
    router.prefetch(SIDES.landlord.href);
  }, [router]);

  // If the navigation ends without leaving this page (offline, blocked), give the panels back.
  useEffect(() => {
    if (startedNavigation.current && !isPending) {
      startedNavigation.current = false;
      setFloodingTo(null);
      setHovered(null);
    }
  }, [isPending]);

  function enter(side: Side) {
    if (floodingTo) return; // a second tap while one is under way
    setFloodingTo(side);
    // Let the flood read before the route changes.
    window.setTimeout(() => {
      startedNavigation.current = true;
      startTransition(() => router.push(SIDES[side].href));
    }, 260);
  }

  function widthFor(side: Side) {
    if (floodingTo) return floodingTo === side ? "100%" : "0%";
    if (!hovered) return "50%";
    return hovered === side ? "55%" : "45%";
  }

  return (
    // h-screen (not min-h-screen): the nested flex-1/h-full chain below
    // (desktop wrapper -> hero row -> panel buttons) needs a genuinely
    // definite ancestor height to stretch against. A min-height alone lets
    // Chrome size this element from its own content first and only clamp it
    // up afterward, so percentage/stretch sizing several flex levels down
    // resolves against that pre-clamp (content) height instead of the real
    // viewport height — the panels end up hugging their content instead of
    // filling the screen, leaving a blank gap above the footer.
    <div className="theme-fade flex h-screen w-full flex-col">
      {/* Spoken once a portal has been chosen; the visual feedback is the flood and the sweep. */}
      <span role="status" className="sr-only">
        {floodingTo ? "Opening portal" : ""}
      </span>
      <button
        type="button"
        onClick={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
        className="press fixed right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md"
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
            // The width change is a plain CSS transition (see .panel-width): hovering in and out
            // mid-flight reverses smoothly, and the landing page no longer ships a motion library.
            <button
              key={side}
              type="button"
              onMouseEnter={() => !floodingTo && setHovered(side)}
              onMouseLeave={() => !floodingTo && setHovered(null)}
              onClick={() => enter(side)}
              className="panel-width group relative flex h-full flex-col items-start justify-center overflow-hidden px-12 text-left"
              style={{ width: widthFor(side), backgroundColor: side === "landlord" ? t.landlordBg : t.tenantBg }}
            >
              <Skyline side={side} color={ACCENT[side].main} />
              <PanelContent side={side} theme={theme} compact={false} />
              {floodingTo === side && <LoadingSweep color={ACCENT[side].light} />}
            </button>
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
            // A tap answers at once: the panel presses in, the other fades back, and a bar sweeps
            // its edge until the next page is ready.
            <button
              key={side}
              type="button"
              onClick={() => enter(side)}
              className="relative flex flex-1 flex-col justify-center overflow-hidden px-6 py-10 text-left transition-[opacity,transform,background-color] duration-300 active:scale-[0.99] motion-reduce:active:scale-100"
              style={{
                backgroundColor: side === "landlord" ? t.landlordBg : t.tenantBg,
                opacity: floodingTo && floodingTo !== side ? 0.4 : 1,
              }}
            >
              <Skyline side={side} color={ACCENT[side].main} />
              <PanelContent side={side} theme={theme} compact />
              {floodingTo === side && <LoadingSweep color={ACCENT[side].light} />}
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
