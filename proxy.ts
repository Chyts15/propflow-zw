import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/privacy(.*)",
  "/api/webhooks(.*)",
  "/api/trpc(.*)", // tRPC procedures enforce their own auth (lib/trpc.ts) — see CLAUDE.md § Security First
  "/api/cron(.*)", // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`, not a Clerk session —
  // each route checks that header itself (see app/api/cron/*/route.ts); without this entry
  // Clerk's auth.protect() intercepts the request first and 307s to /sign-in before the
  // route's own check ever runs.
]);

// Clerk isn't configured until real keys land (see .env.example) — calling
// clerkMiddleware() without them throws on every request, so fall back to a
// passthrough. This is UX routing only — the actual security boundary is
// landlordProcedure/tenantProcedure (lib/trpc.ts) and the (landlord)/(tenant)
// layout role checks, which re-verify against Postgres every time.
export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) await auth.protect();
    })
  : function passthroughProxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's own same-origin script proxy (auto-enabled for production keys
    // without a custom Clerk domain — see @clerk/nextjs clerkMiddleware).
    // Requests here end in .js, which the pattern above deliberately excludes,
    // so without this entry clerk-js 404s and the app never loads Clerk.
    "/__clerk(.*)",
  ],
};
