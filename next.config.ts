import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry release/source-map upload is a Phase-1-later, CI-time concern — it
// no-ops locally without SENTRY_AUTH_TOKEN (see .env.example), it just won't
// upload source maps. Error capture itself (instrumentation.ts) doesn't need it.
export default withSentryConfig(nextConfig, {
  silent: true,
});
