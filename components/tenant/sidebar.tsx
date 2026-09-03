"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Home, Receipt, MessageSquare, User } from "lucide-react";
import { TENANT_DARK } from "@/components/tenant/theme";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/rent", label: "Rent", icon: Receipt },
  { href: "/my-complaints", label: "Complaints", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export function TenantSidebar({ tenantName, unitLabel }: { tenantName: string; unitLabel: string }) {
  const pathname = usePathname();
  const t = TENANT_DARK;
  const initials = tenantName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col sm:flex" style={{ backgroundColor: t.sidebarBg, color: t.fg }}>
      <div className="flex items-center gap-2 px-5 py-6">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M14 3 L25 12 L25 25 L3 25 L3 12 Z" fill="#c8522a" />
          <path d="M14 3 L25 12 L14 16 L3 12 Z" fill={t.accent} />
        </svg>
        <p className="font-heading text-base font-extrabold">
          PropFlow <span style={{ color: t.fgMuted }}>ZW</span>
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition"
              style={{
                border: active ? `1px solid ${t.accent}` : "1px solid transparent",
                backgroundColor: active ? `${t.accent}1a` : "transparent",
                color: active ? t.accentLight : t.fgMuted,
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 px-4 py-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ backgroundColor: t.accent, color: "#fff" }}
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{tenantName}</span>
          <span className="block truncate text-xs" style={{ color: t.fgMuted }}>
            {unitLabel}
          </span>
        </span>
      </div>
      <div className="px-4 pb-4">
        <span
          className="inline-block rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide"
          style={{ backgroundColor: `${t.accent}26`, color: t.accentLight }}
        >
          INCLUDED FREE
        </span>
      </div>
      <div className="border-t px-4 py-3" style={{ borderColor: t.cardBorder }}>
        <UserButton />
      </div>
    </aside>
  );
}
