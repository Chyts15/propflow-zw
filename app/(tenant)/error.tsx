"use client"; // Error boundaries must be Client Components

import { TenantErrorPanel } from "@/components/tenant/error-panel";

// Catches a failure in any tenant page and shows it inside the tenant shell, so the sidebar and
// tab bar stay usable. It does not catch a failure in app/(tenant)/layout.tsx itself; that falls
// through to app/error.tsx (landlord-themed, and outside the tenant surfaces). Next.js 16.3
// passes `retry` (stable since 16.3.0).
export default function TenantError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <TenantErrorPanel error={error} retry={retry} homeHref="/home" homeLabel="BACK TO HOME" />;
}
