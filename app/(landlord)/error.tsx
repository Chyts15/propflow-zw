"use client"; // Error boundaries must be Client Components

import { ErrorPanel } from "@/components/shared/error-panel";

// Catches a failure in any landlord page and shows it inside the app shell, so the sidebar and
// tab bar stay usable. It does not catch a failure in app/(landlord)/layout.tsx itself; that
// falls through to app/error.tsx. Next.js 16.3 passes `retry` (stable since 16.3.0).
export default function LandlordError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} homeHref="/dashboard" homeLabel="BACK TO DASHBOARD" />;
}
