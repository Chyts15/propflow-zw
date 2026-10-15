"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";

export function TenantSignOutButton() {
  const t = TENANT_DARK;
  return (
    <SignOutButton redirectUrl="/">
      <button
        type="button"
        className={`press flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 font-mono text-xs font-medium sm:w-auto ${TENANT_FOCUS_RING}`}
        style={{ border: `1px solid ${t.cardBorder}`, color: t.fg }}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" /> SIGN OUT
      </button>
    </SignOutButton>
  );
}
