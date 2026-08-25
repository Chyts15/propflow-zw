"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Building2, Users, Receipt, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { href: "/properties", label: "Properties", icon: Building2, enabled: true },
  { href: "/tenants", label: "Tenants", icon: Users, enabled: true },
  { href: "/finances", label: "Finances", icon: Receipt, enabled: false },
  { href: "/complaints", label: "Complaints", icon: MessageSquare, enabled: false },
  { href: "/settings", label: "Settings", icon: Settings, enabled: false },
];

export function LandlordSidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-brand-primary-dark text-white/90">
      <div className="px-5 py-6">
        <p className="font-heading text-lg font-extrabold text-white">PropFlow</p>
        <p className="mt-0.5 truncate text-xs text-white/60">{orgName}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon, enabled }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          if (!enabled) {
            return (
              <span
                key={href}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white/35"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">SOON</span>
              </span>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4">
        <UserButton />
        <span className="text-xs text-white/60">Account</span>
      </div>
    </aside>
  );
}
