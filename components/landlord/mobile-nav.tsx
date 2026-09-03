"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, Building2, Receipt, MessageSquare, MoreHorizontal } from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

// Bottom tab bar collapses the sidebar's 6 sections into 5 slots, matching
// the mockup's Home/Units/Finances/Issues/More pattern — Tenants and
// Settings fold into "More" (no dedicated mobile mockup shows a 6th tab).
const TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, enabled: true },
  { href: "/properties", label: "Units", icon: Building2, enabled: true },
  { href: "/finances", label: "Finances", icon: Receipt, enabled: false },
  { href: "/complaints", label: "Issues", icon: MessageSquare, enabled: false, badge: 2 },
  { href: "/tenants", label: "More", icon: MoreHorizontal, enabled: true },
];

export function MobileTopBar() {
  const t = LANDLORD_DARK;
  return (
    <header
      className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between px-4 sm:hidden"
      style={{ backgroundColor: t.sidebarBg, borderBottom: `1px solid ${t.cardBorder}` }}
    >
      <span className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill={t.accent} />
          <path d="M14 3 L25 12 L14 16 L3 12 Z" fill="#0e7c6b" />
        </svg>
        <span className="font-heading text-sm font-extrabold" style={{ color: t.fg }}>
          PropFlow <span style={{ color: t.fgMuted }}>ZW</span>
        </span>
      </span>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ color: t.fgMuted }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
      </button>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const t = LANDLORD_DARK;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch justify-around sm:hidden"
      style={{ backgroundColor: t.sidebarBg, borderTop: `1px solid ${t.cardBorder}` }}
    >
      {TABS.map(({ href, label, icon: Icon, enabled, badge }) => {
        const active = enabled && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={enabled ? href : "#"}
            aria-disabled={!enabled}
            onClick={(e) => !enabled && e.preventDefault()}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
            style={{ color: active ? t.accent : enabled ? t.fgMuted : t.fgFaint }}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {enabled && badge ? (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
