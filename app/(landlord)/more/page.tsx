import Link from "next/link";
import { Users, Settings, ChevronRight } from "lucide-react";
import { LANDLORD_DARK } from "@/components/landlord/theme";

// Mobile-only landing for the bottom tab bar's "More" slot — the sidebar
// shows Tenants/Settings directly, but the 5-tab mobile bar (mockup:
// Home/Units/Finances/Issues/More) folds them in here instead of a 6th tab.
const ITEMS = [
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/settings/billing", label: "Settings", icon: Settings },
];

export default function MorePage() {
  const t = LANDLORD_DARK;
  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        More
      </h1>
      <div className="mt-6 space-y-2">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-2xl p-4"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
          >
            <span className="flex items-center gap-3 text-sm font-medium" style={{ color: t.fg }}>
              <Icon className="h-4 w-4" style={{ color: t.fgMuted }} />
              {label}
            </span>
            <ChevronRight className="h-4 w-4" style={{ color: t.fgMuted }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
