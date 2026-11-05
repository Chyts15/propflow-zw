"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";

// Fallback UI for the app's error boundaries (app/error.tsx and app/(landlord)/error.tsx).
// Plain language, no jargon, always a way to retry. The message names a cause landlords and
// tenants actually hit here (a slow or dropped connection) and tells them their data is safe.

const t = LANDLORD_DARK;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function ErrorPanel({
  error,
  retry,
  fullScreen = false,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  /** True where there is no app shell around the panel (a failure in the layout itself). */
  fullScreen?: boolean;
  homeHref?: string;
  homeLabel?: string;
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
    <div
      role="alert"
      className={`flex items-center justify-center p-6 ${fullScreen ? "min-h-screen" : "min-h-[60vh]"}`}
      style={fullScreen ? { backgroundColor: t.mainBg, color: t.fg } : undefined}
    >
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
            : "This is usually a slow or dropped connection, not something you did. Your data is safe."}
        </p>

        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetriedFor(error);
              retry();
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-2xl bg-brand-primary-dark px-5 font-mono text-xs font-medium text-white transition hover:bg-brand-primary disabled:opacity-60 ${FOCUS_RING}`}
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? "motion-safe:animate-spin" : ""}`} aria-hidden="true" />
            {retrying ? "TRYING AGAIN…" : "TRY AGAIN"}
          </button>
          {homeHref && pathname !== homeHref && (
            <Link
              href={homeHref}
              className={`inline-flex min-h-11 items-center rounded-2xl px-5 font-mono text-xs font-medium ${FOCUS_RING}`}
              style={{ color: t.fgMuted }}
            >
              {homeLabel ?? "GO BACK"}
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
