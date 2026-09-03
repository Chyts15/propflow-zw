"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  MessageSquare,
  Settings,
} from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/properties", label: "Properties", icon: Building2, enabled: true },
  { href: "/tenants", label: "Tenants", icon: Users, enabled: true },
  { href: "/finances", label: "Finances", icon: Receipt, enabled: false },
  { href: "/complaints", label: "Complaints", icon: MessageSquare, enabled: false, badge: 2 },
  { href: "/settings", label: "Settings", icon: Settings, enabled: false },
];

export function LandlordSidebar({
  orgName,
  userName,
  tier,
  unitCount,
}: {
  orgName: string;
  userName: string;
  tier: string;
  unitCount: number;
}) {
  const pathname = usePathname();
  const t = LANDLORD_DARK;
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className="hidden h-screen w-60 shrink-0 flex-col sm:flex"
      style={{ backgroundColor: t.sidebarBg, color: t.fg }}
    >
      <div className="flex items-center gap-2 px-5 py-6">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill={t.accent} />
          <path d="M14 3 L25 12 L14 16 L3 12 Z" fill="#0e7c6b" />
        </svg>
        <p className="font-heading text-base font-extrabold">
          PropFlow <span style={{ color: t.fgMuted }}>ZW</span>
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon, enabled, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={enabled ? href : "#"}
              aria-disabled={!enabled}
              onClick={(e) => !enabled && e.preventDefault()}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition"
              style={{
                border: active ? `1px solid ${t.accent}` : "1px solid transparent",
                backgroundColor: active ? `${t.accent}1a` : "transparent",
                color: enabled ? (active ? t.accent : t.fgMuted) : t.fgFaint,
                cursor: enabled ? "pointer" : "default",
              }}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4" />
                {label}
              </span>
              {enabled && badge ? (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  {badge}
                </span>
              ) : !enabled ? (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">SOON</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderTop: `1px solid ${t.cardBorder}` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: t.accent, color: "#fff" }}
          >
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{userName}</span>
            <span className="block truncate text-xs" style={{ color: t.fgMuted }}>
              {orgName}
            </span>
          </span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <span
          className="inline-block rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide"
          style={{ backgroundColor: t.cardBg, color: t.fgMuted }}
        >
          {tier} · {unitCount} UNITS
        </span>
      </div>
      <div className="border-t px-4 py-3" style={{ borderColor: t.cardBorder }}>
        <UserButton />
      </div>
    </aside>
  );
}
