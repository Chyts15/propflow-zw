"use client"; // Error boundaries must be Client Components

import { ErrorPanel } from "@/components/shared/error-panel";

// App-wide fallback. It sits above every route group, so it also catches failures in the
// landlord and tenant layouts (which query the database before rendering) that the
// per-group error.tsx files cannot. There is no app shell here, so the panel fills the screen.
// It does not cover app/layout.tsx; that would need a global-error.tsx.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} fullScreen homeHref="/" homeLabel="GO TO START" />;
}
