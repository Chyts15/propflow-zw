"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Receipt, MessageSquare, User } from "lucide-react";
import { TENANT_DARK } from "@/components/tenant/theme";

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/rent", label: "Rent", icon: Receipt },
  { href: "/my-complaints", label: "Issues", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export function TenantMobileTopBar({ tenantName, unitLabel }: { tenantName: string; unitLabel: string }) {
  const t = TENANT_DARK;
  return (
    <header
      className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between px-4 sm:hidden"
      style={{ backgroundColor: t.sidebarBg, borderBottom: `1px solid ${t.cardBorder}` }}
    >
      <span className="flex items-center gap-2 overflow-hidden">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none" className="shrink-0">
          <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill="#c8522a" />
          <path d="M14 3 L25 12 L14 16 L3 12 Z" fill={t.accent} />
        </svg>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold" style={{ color: t.fg }}>
            {tenantName}
          </span>
          <span className="block truncate text-[10px]" style={{ color: t.fgMuted }}>
            {unitLabel}
          </span>
        </span>
      </span>
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ color: t.fgMuted }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
      </button>
    </header>
  );
}

export function TenantMobileTabBar() {
  const pathname = usePathname();
  const t = TENANT_DARK;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch justify-around sm:hidden"
      style={{ backgroundColor: t.sidebarBg, borderTop: `1px solid ${t.cardBorder}` }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-0.5"
            style={{ color: active ? t.accentLight : t.fgMuted }}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
