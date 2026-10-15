import Link from "next/link";

// Spec: CLAUDE.md § Tier Gating — "render blurred with UpgradePrompt →
// /settings/billing" for any over-limit landlord feature. Sits in normal flow
// under the gated control, which is usually too narrow to hold the message
// itself. It used to be an absolutely positioned popover, which laid over
// whatever came next (the first unit row, on the property page).
export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div
      className="w-full max-w-xs rounded-xl p-3 text-center"
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
