import Link from "next/link";
import { FOCUS_RING, LANDLORD_DARK } from "@/components/landlord/theme";
import { pagerHref } from "@/lib/pagination";

// Next / first-page links for a list whose cursor is in the URL (see lib/pagination.ts). Plain
// links rather than a button with state: they work before the page hydrates, which is what a
// phone on a slow connection needs. Renders nothing for a list that fits on one page.
export function ListPager({
  basePath,
  query = {},
  cursor,
  nextCursor,
  noun,
}: {
  basePath: string;
  /** Other parameters to keep, such as the month on the rent ledger. */
  query?: Record<string, string | undefined>;
  /** The cursor this page was opened with; absent on the first page. */
  cursor?: string;
  nextCursor: string | null;
  /** What the list holds, for the accessible label: "properties", "rent records". */
  noun: string;
}) {
  const t = LANDLORD_DARK;
  if (!cursor && !nextCursor) return null;

  const link = `${FOCUS_RING} press inline-flex min-h-11 items-center rounded-lg px-3 font-mono text-xs`;
  return (
    <nav aria-label={`More ${noun}`} className="mt-4 flex items-center justify-between gap-3">
      {cursor ? (
        <Link href={pagerHref(basePath, query)} className={link} style={{ color: t.fgMuted }}>
          ← FIRST PAGE
        </Link>
      ) : (
        <span />
      )}
      {nextCursor && (
        <Link
          href={pagerHref(basePath, query, nextCursor)}
          className={link}
          style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.accentLight }}
        >
          NEXT PAGE →
        </Link>
      )}
    </nav>
  );
}
