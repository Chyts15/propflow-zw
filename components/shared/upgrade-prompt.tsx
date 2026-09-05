import Link from "next/link";

// Spec: CLAUDE.md § Tier Gating — "render blurred with UpgradePrompt →
// /settings/billing" for any over-limit landlord feature. Anchored as its
// own popover below-right of the gated control rather than stretched to
// match it — the control (e.g. a small pill button) is usually too narrow
// to hold the message text itself.
export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div
      className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl p-3 text-center shadow-lg"
      style={{ backgroundColor: "#1f130d", border: "1px solid #3a2216" }}
    >
      <p className="text-xs text-white/90">{message}</p>
      <Link
        href="/settings/billing"
        className="mt-2 inline-block rounded-lg px-3 py-1.5 font-mono text-[11px] font-medium text-white"
        style={{ backgroundColor: "#c8522a" }}
      >
        Upgrade plan
      </Link>
    </div>
  );
}
