"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Side = "landlord" | "tenant";

const SIDES: Record<
  Side,
  { label: string; tagline: string; bg: string; href: string; secondary?: { label: string; href: string } }
> = {
  landlord: {
    label: "Landlord",
    tagline: "Rent ledger, complaints, SMS reminders — get your rent paid on time.",
    bg: "bg-brand-primary-dark",
    href: "/sign-in",
    secondary: { label: "New landlord? Get started", href: "/sign-up" },
  },
  tenant: {
    label: "Tenant",
    tagline: "Rent status, payment-proof upload, complaint reporting.",
    bg: "bg-brand-secondary-dark",
    href: "/sign-in",
  },
};

export function PortalLanding() {
  const router = useRouter();
  const [hovered, setHovered] = useState<Side | null>(null);
  const [floodingTo, setFloodingTo] = useState<Side | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Side | null>(null);

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
    <div className="min-h-screen w-full">
      {/* Desktop / tablet: horizontal split */}
      <div className="hidden h-screen w-full sm:flex">
        {(Object.keys(SIDES) as Side[]).map((side) => (
          <motion.button
            key={side}
            type="button"
            onMouseEnter={() => !floodingTo && setHovered(side)}
            onMouseLeave={() => !floodingTo && setHovered(null)}
            onClick={() => enter(side)}
            animate={{ width: widthFor(side) }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={cn(
              "relative flex h-full flex-col items-center justify-center overflow-hidden px-10 text-left text-white",
              SIDES[side].bg,
            )}
          >
            <div className="max-w-sm">
              <p className="font-heading text-4xl font-extrabold">{SIDES[side].label}</p>
              <p className="mt-3 text-white/85">{SIDES[side].tagline}</p>
              {SIDES[side].secondary && (
                <a
                  href={SIDES[side].secondary!.href}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-4 inline-block text-sm font-medium text-white underline underline-offset-4"
                >
                  {SIDES[side].secondary!.label}
                </a>
              )}
            </div>
          </motion.button>
        ))}

        {/* Soapstone bird logo lockup — divider */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <span className="font-heading text-xl font-extrabold text-brand-accent">P</span>
          </div>
        </div>
      </div>

      {/* Mobile: vertical stack, tap-to-expand */}
      <div className="flex min-h-screen flex-col sm:hidden">
        {(Object.keys(SIDES) as Side[]).map((side) => {
          const expanded = mobileExpanded === side;
          return (
            <motion.div
              key={side}
              animate={{ flexGrow: expanded ? 3 : 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn("flex flex-col justify-center overflow-hidden px-6 py-8 text-white", SIDES[side].bg)}
              onClick={() => (expanded ? enter(side) : setMobileExpanded(side))}
            >
              <p className="font-heading text-2xl font-extrabold">{SIDES[side].label}</p>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="mt-2 text-sm text-white/85">{SIDES[side].tagline}</p>
                    <p className="mt-3 text-sm font-medium underline underline-offset-4">
                      Tap again to continue
                    </p>
                    {SIDES[side].secondary && (
                      <a
                        href={SIDES[side].secondary!.href}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 inline-block text-sm font-medium text-white underline underline-offset-4"
                      >
                        {SIDES[side].secondary!.label}
                      </a>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
