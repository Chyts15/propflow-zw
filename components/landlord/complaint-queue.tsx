"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck, MessageSquareText, Search } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc-client";
import type { AppRouter } from "@/lib/routers/_app";
import {
  FOCUS_RING,
  LANDLORD_DARK,
  PRIORITY_FILL,
  PRIORITY_UNDERGLOW,
  RESOLVED_CARD_FILL,
} from "@/components/landlord/theme";
import {
  DEFAULT_FILTER,
  QUEUE_FILTERS,
  QUEUE_FILTER_LABEL,
  buildQueue,
  describeEmpty,
  isResolved,
  needsResolvedFeed,
  nextFeed,
  queueLine,
  type QueueFilter,
} from "@/lib/complaint-queue";
import { formatLongDate } from "@/lib/dates";
import { friendlyMessage } from "@/lib/trpc-error";
import { formatRelativeTime } from "@/lib/utils";

type FirstPage = inferRouterOutputs<AppRouter>["complaints"]["list"];

const t = LANDLORD_DARK;
const BONE = "rgba(255,255,255,0.07)";

// On a phone the queue and the thread take turns: the queue on /complaints, the thread on
// /complaints/<id>. From sm up they sit side by side.
function frameClass(isIndexRoute: boolean) {
  return `h-full w-full shrink-0 flex-col sm:flex sm:w-[360px] ${isIndexRoute ? "flex" : "hidden"}`;
}

const FRAME_STYLE = { backgroundColor: t.sidebarBg, borderRight: `1px solid ${t.cardBorder}` } as const;

function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md motion-safe:animate-pulse ${className}`} style={{ backgroundColor: BONE }} />;
}

function CardBones({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden="true" className="rounded-2xl p-3" style={{ backgroundColor: t.cardBg }}>
          <Bone className="h-4 w-3/5" />
          <Bone className="mt-2 h-3.5 w-4/5" />
          <Bone className="mt-2.5 h-3 w-2/5" />
        </li>
      ))}
    </>
  );
}

/** The queue's shape while it loads: same header height and card rhythm, so nothing jumps. */
export function ComplaintQueueSkeleton() {
  const isIndexRoute = usePathname() === "/complaints";
  return (
    <aside role="status" aria-busy="true" className={frameClass(isIndexRoute)} style={FRAME_STYLE}>
      <span className="sr-only">Loading complaints…</span>
      <div className="shrink-0 px-4 pb-3 pt-4">
        <Bone className="h-6 w-32" />
        <Bone className="mt-3 h-11 w-full rounded-2xl" />
        <div className="mt-3 flex gap-2 overflow-hidden">
          {[64, 52, 96, 76, 44].map((w) => (
            <div
              key={w}
              aria-hidden="true"
              className="h-11 shrink-0 rounded-full motion-safe:animate-pulse"
              style={{ width: w + 28, backgroundColor: BONE }}
            />
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-hidden px-3 pb-4">
        <CardBones count={5} />
      </ul>
    </aside>
  );
}

export function ComplaintQueue({ firstPage }: { firstPage: FirstPage }) {
  const pathname = usePathname();
  const isIndexRoute = pathname === "/complaints";
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<QueueFilter>(DEFAULT_FILTER);
  const [search, setSearch] = useState("");

  // Two feeds from the server, each paged by cursor: the active complaints (the first page arrives
  // with the layout, so the queue paints with its data) and the resolved ones (fetched when a
  // chip needs them). The thread refreshes both after a status change.
  const active = trpc.complaints.list.useInfiniteQuery(
    { scope: "ACTIVE" },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      initialData: { pages: [firstPage], pageParams: [undefined] },
      staleTime: 30_000,
      retry: 1,
    },
  );
  const activeItems = useMemo(() => active.data?.pages.flatMap((p) => p.items) ?? [], [active.data]);
  const activeHasMore = active.hasNextPage;

  const wantResolved = needsResolvedFeed(filter, activeHasMore);
  const resolved = trpc.complaints.list.useInfiniteQuery(
    { scope: "RESOLVED" },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      enabled: wantResolved,
      staleTime: 30_000,
      retry: 1,
    },
  );
  const resolvedItems = useMemo(() => resolved.data?.pages.flatMap((p) => p.items) ?? [], [resolved.data]);

  const queue = useMemo(
    () => buildQueue({ filter, query: search, active: activeItems, resolved: resolvedItems, activeHasMore }),
    [filter, search, activeItems, resolvedItems, activeHasMore],
  );

  const feed = nextFeed(filter, activeHasMore, resolved.hasNextPage);
  const loadingMore = active.isFetchingNextPage || resolved.isFetchingNextPage;
  const loadMoreFailed = active.isFetchNextPageError || resolved.isFetchNextPageError;
  const resolvedLoading = wantResolved && resolved.isPending && !resolved.isError;
  const resolvedFailed = wantResolved && resolved.isError && !resolved.data;
  const refreshFailed = active.isRefetchError;

  const loadedCount =
    filter === "RESOLVED" ? resolvedItems.length : activeItems.length + (filter === "ALL" && wantResolved ? resolvedItems.length : 0);
  const empty = queue.length === 0 && !resolvedLoading && !resolvedFailed;
  const emptyView = empty ? describeEmpty({ filter, query: search, loaded: loadedCount, hasMore: feed !== null }) : null;

  function loadMore() {
    if (loadingMore) return;
    if (feed === "ACTIVE") void active.fetchNextPage();
    else if (feed === "RESOLVED") void resolved.fetchNextPage();
  }

  function selectFilter(next: QueueFilter) {
    setFilter(next);
    listRef.current?.scrollTo({ top: 0 });
  }

  const word = search.trim() ? "found" : filter === "ALL" ? "complaints" : QUEUE_FILTER_LABEL[filter].toLowerCase();
  const countText = `${queue.length}${feed ? "+" : ""} ${word}`;

  return (
    <aside aria-label="Complaints" className={frameClass(isIndexRoute)} style={FRAME_STYLE}>
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-heading text-xl font-extrabold" style={{ color: t.fg }}>
            Complaints
          </h1>
          {!empty && !resolvedLoading && (
            <p role="status" className="font-mono text-[11px] uppercase tracking-wide" style={{ color: t.fgMuted }}>
              {countText}
            </p>
          )}
        </div>

        <div className="relative mt-3">
          <label htmlFor="complaint-search" className="sr-only">
            Search complaints by unit, tenant, property or issue
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: t.fgMuted }} />
          <input
            id="complaint-search"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search unit, tenant or issue"
            className={`min-h-11 w-full rounded-2xl py-2 pl-10 pr-3 text-sm placeholder:text-white/55 ${FOCUS_RING}`}
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>

        {/* On a phone: one row that scrolls sideways, because five 44px chips would stack two
            rows high and eat the screen; the last chip peeks in as the hint. From sm up there is
            room, so the row wraps and every chip shows. */}
        <div
          role="group"
          aria-label="Filter complaints"
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {QUEUE_FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => selectFilter(f)}
                className={`press min-h-11 shrink-0 rounded-full px-3.5 font-mono text-[11px] ${FOCUS_RING}`}
                style={
                  on
                    ? { backgroundColor: t.accent, color: "#fff" }
                    : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: "rgba(255,255,255,0.75)" }
                }
              >
                {QUEUE_FILTER_LABEL[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {refreshFailed && (
          <p role="status" className="mb-2 rounded-2xl px-3 py-2 text-xs" style={{ backgroundColor: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
            Couldn&apos;t refresh just now. Showing what was loaded.
          </p>
        )}

        {emptyView && (
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            {emptyView.kind === "all-clear" ? (
              <CircleCheck aria-hidden="true" className="mx-auto h-6 w-6" style={{ color: "#4ade80" }} />
            ) : (
              <MessageSquareText aria-hidden="true" className="mx-auto h-6 w-6" style={{ color: t.fgMuted }} />
            )}
            <p className="mt-2 text-sm font-semibold" style={{ color: t.fg }}>
              {emptyView.title}
            </p>
            <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
              {emptyView.hint}
            </p>
            <div className="mt-3 flex flex-col items-center gap-1">
              {emptyView.kind === "keep-looking" && feed && (
                <QueueButton onClick={loadMore} busy={loadingMore}>
                  {loadingMore ? "LOADING…" : "LOAD MORE"}
                </QueueButton>
              )}
              {search.trim() && <QueueButton onClick={() => setSearch("")}>CLEAR SEARCH</QueueButton>}
              {emptyView.kind === "all-clear" && filter === "ACTIVE" && (
                <QueueButton onClick={() => selectFilter("RESOLVED")}>SEE RESOLVED</QueueButton>
              )}
              {emptyView.kind === "all-clear" && filter !== "ACTIVE" && (
                <QueueButton onClick={() => selectFilter("ACTIVE")}>SHOW ACTIVE</QueueButton>
              )}
            </div>
          </div>
        )}

        {queue.length > 0 && (
          <ul className="space-y-2">
            {queue.map((c) => {
              const current = pathname === `/complaints/${c.id}`;
              const done = isResolved(c.status);
              const fill = done ? RESOLVED_CARD_FILL : (PRIORITY_FILL[c.priority] ?? t.cardBg);
              // Urgency alone earns the glow: resolved and closed cards sit flat. The glow is its
              // own colour, not the card's fill. The current card also gets a 2px ring.
              const glow = done ? null : PRIORITY_UNDERGLOW[c.priority];
              const shadow = [current ? `0 0 0 2px ${t.accentLight}` : null, glow ? `0 0 22px -8px ${glow}` : null]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={c.id}>
                  <Link
                    href={`/complaints/${c.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`press block min-h-11 rounded-2xl p-3 ${FOCUS_RING}`}
                    style={{
                      backgroundColor: fill,
                      border: `1px solid ${done ? t.cardBorder : "rgba(255,255,255,0.06)"}`,
                      boxShadow: shadow || undefined,
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">
                        Unit {c.unit.unitNumber} · {c.tenantName}
                      </p>
                      <time
                        dateTime={c.createdAt.toISOString()}
                        title={formatLongDate(c.createdAt)}
                        suppressHydrationWarning
                        className="shrink-0 text-[11px] text-white/80"
                      >
                        {formatRelativeTime(c.createdAt, { short: true })}
                      </time>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/90">{c.title}</p>
                    <div className="mt-1.5 flex items-baseline justify-between gap-3 font-mono text-[11px] tracking-wide text-white/80">
                      <span className="shrink-0">{queueLine(c.priority, c.status)}</span>
                      {c.unit.property?.name && <span className="min-w-0 truncate">{c.unit.property.name}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {resolvedLoading && (
          <ul role="status" aria-busy="true" className={`space-y-2 ${queue.length > 0 ? "mt-2" : ""}`}>
            <li className="sr-only">Loading resolved complaints…</li>
            <CardBones count={queue.length > 0 ? 2 : 4} />
          </ul>
        )}

        {resolvedFailed && (
          <div role="alert" className="rounded-2xl p-5 text-center" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <p className="text-sm font-semibold" style={{ color: t.fg }}>
              Couldn&apos;t load resolved complaints
            </p>
            <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
              {friendlyMessage(resolved.error, "Check your connection and try again.")}
            </p>
            <div className="mt-3">
              <QueueButton onClick={() => void resolved.refetch()}>TRY AGAIN</QueueButton>
            </div>
          </div>
        )}

        {feed && queue.length > 0 && (
          <div className="pt-3 text-center">
            <QueueButton onClick={loadMore} busy={loadingMore}>
              {loadingMore ? "LOADING…" : "LOAD MORE"}
            </QueueButton>
            {loadMoreFailed && (
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

function QueueButton({
  onClick,
  busy = false,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={busy || undefined}
      className={`press min-h-11 rounded-2xl px-4 font-mono text-xs aria-disabled:opacity-60 ${FOCUS_RING}`}
      style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.accentLight }}
    >
      {children}
    </button>
  );
}
