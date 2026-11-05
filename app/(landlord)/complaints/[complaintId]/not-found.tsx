import Link from "next/link";
import { SearchX } from "lucide-react";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";

// A complaint that does not exist, or belongs to another landlord: the lookup is scoped to the
// organisation, so both look the same from here. The queue stays on screen beside this.
export default function ComplaintNotFound() {
  const t = LANDLORD_DARK;
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center sm:p-8"
        style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
      >
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: t.fgMuted }}
        >
          <SearchX aria-hidden="true" className="h-5 w-5" />
        </span>
        <h1 className="font-heading mt-4 text-xl font-extrabold" style={{ color: t.fg }}>
          We couldn&rsquo;t find that complaint
        </h1>
        <p className="mt-2 text-sm" style={{ color: t.fgMuted }}>
          It may have been removed, or the link is out of date. Pick another complaint from your list.
        </p>
        <Link
          href="/complaints"
          className={`press mt-6 inline-flex min-h-11 items-center rounded-2xl px-5 font-mono text-xs font-medium text-white ${FOCUS_RING}`}
          style={{ backgroundColor: t.accent }}
        >
          BACK TO COMPLAINTS
        </Link>
      </div>
    </div>
  );
}
