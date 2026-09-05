"use client";

import { useEffect } from "react";

// Registers the no-op-cache service worker (public/sw.js) purely so the app
// meets installable-PWA criteria — see CLAUDE.md § SCOPE, no offline sync yet.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
