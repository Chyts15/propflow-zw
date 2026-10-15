"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { FOCUS_RING, LANDLORD_DARK, PRIORITY_GLOW } from "@/components/landlord/theme";
import { formatRelativeTime } from "@/lib/utils";

const FILTERS = ["All", "Open", "In Progress", "Resolved"] as const;
const FILTER_STATUS: Record<(typeof FILTERS)[number], string[] | null> = {
  All: null,
  Open: ["OPEN"],
  "In Progress": ["IN_PROGRESS", "PENDING_PARTS"],
  Resolved: ["RESOLVED", "CLOSED"],
};
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

type ComplaintListItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  unit: { unitNumber: string };
  tenantName: string;
};

export function ComplaintQueue({
  complaints: firstPage,
  nextCursor: firstPageCursor,
}: {
  complaints: ComplaintListItem[];
  /** Where the next page starts, or null when the first page is everything. */
  nextCursor: string | null;
}) {
  const t = LANDLORD_DARK;
  const pathname = usePathname();
  const utils = trpc.useUtils();

  // Only the first page comes from the server. "Load more" appends further pages here, and they are
  // merged by id with the server's page winning: a status change in the thread pane refreshes the
  // layout and brings new first-page props, which must not throw away what was already loaded (or
  // the complaint being read would vanish from the list).
  const [extra, setExtra] = useState<ComplaintListItem[]>([]);
  const [laterCursor, setLaterCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const nextCursor = laterCursor === undefined ? firstPageCursor : laterCursor;
  const complaints = useMemo(() => {
    const onFirstPage = new Set(firstPage.map((c) => c.id));
    return [...firstPage, ...extra.filter((c) => !onFirstPage.has(c.id))];
  }, [firstPage, extra]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadFailed(false);
    try {
      const page = await utils.complaints.list.fetch({ cursor: nextCursor });
      setExtra((previous) => [...previous, ...page.items]);
      setLaterCursor(page.nextCursor);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }
  const isIndexRoute = pathname === "/complaints";
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const statuses = FILTER_STATUS[filter];
    return complaints
      .filter((c) => !statuses || statuses.includes(c.status))
      .filter((c) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return c.title.toLowerCase().includes(q) || c.tenantName.toLowerCase().includes(q) || c.unit.unitNumber.toLowerCase().includes(q);
      })
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  }, [complaints, filter, search]);

  return (
    <aside
      className={`h-full w-full shrink-0 flex-col overflow-y-auto sm:flex sm:w-[360px] ${isIndexRoute ? "flex" : "hidden"}`}
      style={{ backgroundColor: t.sidebarBg, borderRight: `1px solid ${t.cardBorder}` }}
    >
      <div className="p-4">
        <h1 className="font-heading text-xl font-extrabold" style={{ color: t.fg }}>
          Complaints
        </h1>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: t.fgMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit or tenant"
            className="w-full rounded-lg py-2 pl-8 pr-3 text-sm outline-none"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-full px-2.5 py-1 font-mono text-[11px]"
              style={
                filter === f
                  ? { backgroundColor: t.accent, color: "#fff" }
                  : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-3 pb-4">
        {filtered.length === 0 && (
          <p className="p-4 text-center text-sm" style={{ color: t.fgMuted }}>
            {nextCursor
              ? `Nothing matches in the ${complaints.length} loaded so far. Load more to look further.`
              : "No complaints match."}
          </p>
        )}
        {filtered.map((c) => {
          const active = pathname === `/complaints/${c.id}`;
          return (
            <Link
              key={c.id}
              href={`/complaints/${c.id}`}
              className="block rounded-2xl p-3"
              style={{
                backgroundColor: PRIORITY_GLOW[c.priority] ?? t.cardBg,
                boxShadow: `0 0 20px -10px ${PRIORITY_GLOW[c.priority]}`,
                outline: active ? `2px solid ${t.accentLight}` : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Unit {c.unit.unitNumber} · {c.tenantName}
                </p>
                <span className="shrink-0 text-[11px] text-white/60">{formatRelativeTime(c.createdAt, { short: true })}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-white/80">{c.title}</p>
            </Link>
          );
        })}

        {nextCursor && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className={`press min-h-11 rounded-lg px-4 font-mono text-xs disabled:opacity-60 ${FOCUS_RING}`}
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.accentLight }}
            >
              {loadingMore ? "LOADING…" : "LOAD MORE"}
            </button>
            {loadFailed && (
              <p role="alert" className="mt-2 text-xs" style={{ color: "#f87171" }}>
                Couldn&apos;t load more. Check your connection and try again.
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
