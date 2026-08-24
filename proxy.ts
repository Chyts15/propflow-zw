import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

// Clerk isn't configured until real keys land (see .env.example) — calling
// clerkMiddleware() without them throws on every request, so fall back to a
// passthrough. Role-based routing (landlord/tenant) is added in Step 3.
// File is named `proxy.ts`, not `middleware.ts` — Next.js 16 renamed the
// convention (middleware.ts is deprecated as of v16.0.0).
export default clerkConfigured
  ? clerkMiddleware()
  : function passthroughProxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
