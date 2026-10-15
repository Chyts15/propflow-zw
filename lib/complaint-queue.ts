// The landlord's complaint queue as rules: which complaints need the landlord now, in what order
// they appear, what a card says in words, and what an empty list should tell them. Kept free of
// React and Prisma so it is unit tested; the server (lib/db/scoped.ts, lib/routers/complaints.ts)
// and the client (components/landlord/complaint-queue.tsx) both lean on the same groups.

import { COMPLAINT_STATUS_LABEL, PRIORITY_LABEL } from "../components/landlord/theme";

/** Complaints a landlord still has to act on. */
export const ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS"] as const;
/** Complaints that are done with. */
export const RESOLVED_STATUSES = ["RESOLVED", "CLOSED"] as const;

/** The two server-side feeds. "All" in the UI is these two read one after the other. */
export type QueueScope = "ACTIVE" | "RESOLVED";

/**
 * What each feed asks the database for. Active complaints are ordered by urgency; resolved ones by
 * how recently they were touched, so a complaint just marked resolved is first in line when the
 * landlord goes looking for where it went.
 */
export const SCOPE_QUERY: Record<QueueScope, { statuses: readonly string[]; order: "urgency" | "recent" }> = {
  ACTIVE: { statuses: ACTIVE_STATUSES, order: "urgency" },
  RESOLVED: { statuses: RESOLVED_STATUSES, order: "recent" },
};

export const QUEUE_FILTERS = ["ACTIVE", "OPEN", "IN_PROGRESS", "RESOLVED", "ALL"] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];

export const DEFAULT_FILTER: QueueFilter = "ACTIVE";

export const QUEUE_FILTER_LABEL: Record<QueueFilter, string> = {
  ACTIVE: "Active",
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  ALL: "All",
};

export type QueueItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  tenantName: string;
  unit: { unitNumber: string; property?: { name: string } };
};

export const PRIORITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Resolved or closed. A status this file does not know counts as still active, so it is never hidden. */
export function isResolved(status: string): boolean {
  return (RESOLVED_STATUSES as readonly string[]).includes(status);
}

export function matchesFilter(filter: QueueFilter, status: string): boolean {
  switch (filter) {
    case "ACTIVE":
      return !isResolved(status);
    case "OPEN":
      return status === "OPEN";
    case "IN_PROGRESS":
      return status === "IN_PROGRESS" || status === "PENDING_PARTS";
    case "RESOLVED":
      return isResolved(status);
    case "ALL":
      return true;
  }
}

/**
 * Every typed word has to appear somewhere in the unit, tenant, property or title, in any order,
 * so "4b avondale" finds Unit 4B at Avondale Court.
 */
export function matchesSearch(item: QueueItem, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `unit ${item.unit.unitNumber} ${item.tenantName} ${item.unit.property?.name ?? ""} ${item.title}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * Active before resolved; among active, the more urgent first, then the newer; among resolved, the
 * most recently touched first. The id breaks ties the same way the database does, so loaded pages
 * line up with how the server cuts them.
 */
export function compareQueue(a: QueueItem, b: QueueItem): number {
  const aDone = isResolved(a.status);
  const bDone = isResolved(b.status);
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (aDone) {
    return b.updatedAt.getTime() - a.updatedAt.getTime() || compareIdDesc(a, b);
  }
  return (
    (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    compareIdDesc(a, b)
  );
}

function compareIdDesc(a: QueueItem, b: QueueItem): number {
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

/**
 * One entry per id. Pages loaded at different moments can overlap (a priority change moves a row
 * across a page boundary), and the same complaint can sit in both feeds just after a status
 * change; the copy touched most recently wins.
 */
export function dedupeById<T extends { id: string; updatedAt: Date }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const seen = byId.get(item.id);
    if (!seen || item.updatedAt.getTime() > seen.updatedAt.getTime()) byId.set(item.id, item);
  }
  return [...byId.values()];
}

/**
 * The list the landlord sees for a filter and a search.
 *
 * "All" is the active feed followed by the resolved one. While more active pages are still on the
 * server the resolved complaints stay out of it, because they would otherwise sit above an active
 * complaint that has not been loaded yet.
 */
export function buildQueue({
  filter,
  query,
  active,
  resolved,
  activeHasMore,
}: {
  filter: QueueFilter;
  query: string;
  active: QueueItem[];
  resolved: QueueItem[];
  activeHasMore: boolean;
}): QueueItem[] {
  const pool = filter === "ALL" && activeHasMore ? active : [...active, ...resolved];
  return dedupeById(pool)
    .filter((item) => matchesFilter(filter, item.status) && matchesSearch(item, query))
    .sort(compareQueue);
}

/** Which feed "Load more" should extend next, or null when there is nothing further to load. */
export function nextFeed(filter: QueueFilter, activeHasMore: boolean, resolvedHasMore: boolean): QueueScope | null {
  if (filter === "RESOLVED") return resolvedHasMore ? "RESOLVED" : null;
  if (activeHasMore) return "ACTIVE";
  if (filter === "ALL" && resolvedHasMore) return "RESOLVED";
  return null;
}

/** Whether the resolved feed is needed for what is on screen. */
export function needsResolvedFeed(filter: QueueFilter, activeHasMore: boolean): boolean {
  return filter === "RESOLVED" || (filter === "ALL" && !activeHasMore);
}

/** "HIGH · OPEN": priority and status in words, so a card never relies on its colour alone. */
export function queueLine(priority: string, status: string): string {
  const word = (labels: Record<string, string>, key: string) => (labels[key] ?? key.replace(/_/g, " ")).toUpperCase();
  return `${word(PRIORITY_LABEL, priority)} · ${word(COMPLAINT_STATUS_LABEL, status)}`;
}

export type EmptyView = {
  kind: "no-match" | "keep-looking" | "all-clear" | "none-yet";
  title: string;
  hint: string;
};

const PORTAL_HINT = "Tenants report problems from their portal. New ones appear here.";

/** What to say when the list is empty, in plain words, and whether the landlord can act on it. */
export function describeEmpty({
  filter,
  query,
  loaded,
  hasMore,
}: {
  filter: QueueFilter;
  query: string;
  /** How many complaints have been loaded so far, before the filter and search. */
  loaded: number;
  hasMore: boolean;
}): EmptyView {
  const search = query.trim();
  if (hasMore) {
    return {
      kind: "keep-looking",
      title: search ? `No match in the ${loaded} loaded so far` : `Nothing here in the ${loaded} loaded so far`,
      hint: "Load more to look further.",
    };
  }
  if (search) {
    return {
      kind: "no-match",
      title: `Nothing matches “${search}”`,
      hint: "Check the spelling, or try a unit number or tenant name.",
    };
  }
  switch (filter) {
    case "ACTIVE":
      return { kind: "all-clear", title: "Nothing needs you right now", hint: PORTAL_HINT };
    case "OPEN":
      return { kind: "all-clear", title: "No open complaints", hint: PORTAL_HINT };
    case "IN_PROGRESS":
      return { kind: "all-clear", title: "Nothing in progress", hint: "Complaints you start work on show up here." };
    case "RESOLVED":
      return {
        kind: "none-yet",
        title: "No resolved complaints yet",
        hint: "Complaints you mark resolved or closed are kept here.",
      };
    case "ALL":
      return { kind: "none-yet", title: "No complaints yet", hint: PORTAL_HINT };
  }
}
