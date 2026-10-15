// URL-driven cursor pagination for the server-rendered list pages (rent ledger, properties,
// tenants). The cursor lives in `?cursor=` so the page is stateless: it survives
// router.refresh() after a payment is recorded, works with the back button, and needs no
// JavaScript on a slow connection. The data readers in lib/db/scoped.ts already take a cursor
// and return `nextCursor`; the pages used to throw it away, which hid everything past row 20.

// What the tRPC routers accept as an id (zod's cuid check), so the page and the API agree.
const CUID_LIKE = /^[cC][^\s-]{8,}$/;

/** A cursor from the address bar, or undefined if it is missing or not shaped like an id. */
export function parseCursor(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.length <= 40 && CUID_LIKE.test(value) ? value : undefined;
}

/** A list page's address with its other filters kept and the cursor set (or cleared). */
export function pagerHref(basePath: string, query: Record<string, string | undefined>, cursor?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
