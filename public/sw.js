// Basic installability shell — no offline sync, no caching (out of Phase 1
// scope per CLAUDE.md § SCOPE). Rent/billing data must never be served stale,
// so every fetch just passes straight through to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally a no-op — falls through to default browser network handling.
});
