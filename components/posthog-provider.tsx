"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      person_profiles: "identified_only",
      // App Router does full-history client-side navigation without a real
      // page load — posthog-js's own pageleave/pageview autocapture only
      // fires on those, so route changes are tracked manually below instead.
      capture_pageview: false,
    });
  }, []);

  useEffect(() => {
    if (!posthog.__loaded) return;
    posthog.capture("$pageview", { $current_url: pathname });
  }, [pathname]);

  return children;
}
