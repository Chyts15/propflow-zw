"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";

// The tenant portal's error fallback, in the forest theme (components/shared/error-panel.tsx is
// landlord-themed). Plain language, no jargon, always a way to retry, and it says the tenant's
// data is safe: most failures here are a slow or dropped Econet connection, not anything they did.

const t = TENANT_DARK;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function TenantErrorPanel({
  error,
  retry,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref: string;
  homeLabel: string;
}) {
  const pathname = usePathname();
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false,
  );
  // Tracks which error we already retried, so the button re-enables if the retry fails with a new one.
  const [retriedFor, setRetriedFor] = useState<Error | null>(null);
  const retrying = retriedFor === error;

  useEffect(() => {
    // Errors thrown while rendering on the server already reach Sentry through onRequestError
    // (instrumentation.ts) and arrive here with a digest. Report only the ones from the browser.
    if (!error.digest) Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center sm:p-8"
        style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
      >
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(248,113,113,0.15)", color: "#f87171" }}
        >
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="font-heading mt-4 text-xl font-extrabold" style={{ color: t.fg }}>
          We couldn&rsquo;t load this page
        </h1>
        <p className="mt-2 text-sm" style={{ color: t.fgMuted }}>
          {offline
            ? "You look to be offline. Reconnect, then try again."
            : "This is usually a slow or dropped connection, not something you did. Your rent records and complaints are safe."}
        </p>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetriedFor(error);
              retry();
            }}
            className={`press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 font-mono text-xs font-medium disabled:opacity-60 sm:w-auto ${TENANT_FOCUS_RING}`}
            style={{ backgroundColor: t.accentLight, color: "#04140f" }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {retrying ? "TRYING AGAIN…" : "TRY AGAIN"}
          </button>
          {pathname !== homeHref && (
            <Link
              href={homeHref}
              className={`press inline-flex min-h-11 items-center rounded-lg px-5 font-mono text-xs font-medium ${TENANT_FOCUS_RING}`}
              style={{ color: t.fgMuted }}
            >
              {homeLabel}
            </Link>
          )}
        </div>

        {error.digest && (
          <p className="mt-5 font-mono text-[11px]" style={{ color: t.fgMuted }}>
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
