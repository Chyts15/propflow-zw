import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  QUEUE_FILTERS,
  RESOLVED_STATUSES,
  SCOPE_QUERY,
  buildQueue,
  compareQueue,
  dedupeById,
  describeEmpty,
  isResolved,
  matchesFilter,
  matchesSearch,
  needsResolvedFeed,
  nextFeed,
  queueLine,
  type QueueItem,
} from "../complaint-queue";

let seq = 0;
function item(over: Partial<QueueItem> & { day?: number } = {}): QueueItem {
  seq += 1;
  const { day = 10, ...rest } = over;
  return {
    id: `c${String(seq).padStart(10, "0")}`,
    title: "Leaking geyser",
    status: "OPEN",
    priority: "MEDIUM",
    createdAt: new Date(Date.UTC(2026, 9, day, 8)),
    updatedAt: new Date(Date.UTC(2026, 9, day, 8)),
    tenantName: "Tendai Moyo",
    unit: { unitNumber: "4B", property: { name: "Avondale Court" } },
    ...rest,
  };
}

describe("status groups", () => {
  it("keeps active and resolved statuses apart and covers the whole enum between them", () => {
    expect([...ACTIVE_STATUSES, ...RESOLVED_STATUSES].sort()).toEqual(
      ["CLOSED", "IN_PROGRESS", "OPEN", "PENDING_PARTS", "RESOLVED"].sort(),
    );
    expect(isResolved("RESOLVED")).toBe(true);
    expect(isResolved("CLOSED")).toBe(true);
    expect(isResolved("OPEN")).toBe(false);
  });

  it("treats a status it does not know as active so it is never hidden", () => {
    expect(isResolved("ESCALATED")).toBe(false);
    expect(matchesFilter("ACTIVE", "ESCALATED")).toBe(true);
  });

  it("asks the database for active complaints by urgency and resolved ones by recency", () => {
    expect(SCOPE_QUERY.ACTIVE).toEqual({ statuses: ACTIVE_STATUSES, order: "urgency" });
    expect(SCOPE_QUERY.RESOLVED).toEqual({ statuses: RESOLVED_STATUSES, order: "recent" });
  });
});

describe("matchesFilter", () => {
  it("maps each chip to the statuses it shows", () => {
    expect(QUEUE_FILTERS.filter((f) => matchesFilter(f, "OPEN"))).toEqual(["ACTIVE", "OPEN", "ALL"]);
    expect(QUEUE_FILTERS.filter((f) => matchesFilter(f, "IN_PROGRESS"))).toEqual(["ACTIVE", "IN_PROGRESS", "ALL"]);
    expect(QUEUE_FILTERS.filter((f) => matchesFilter(f, "PENDING_PARTS"))).toEqual(["ACTIVE", "IN_PROGRESS", "ALL"]);
    expect(QUEUE_FILTERS.filter((f) => matchesFilter(f, "RESOLVED"))).toEqual(["RESOLVED", "ALL"]);
    expect(QUEUE_FILTERS.filter((f) => matchesFilter(f, "CLOSED"))).toEqual(["RESOLVED", "ALL"]);
  });
});

describe("matchesSearch", () => {
  const c = item({ title: "Burst pipe in kitchen", tenantName: "Rudo Chikwanha", unit: { unitNumber: "12A", property: { name: "Borrowdale Heights" } } });

  it("finds by unit, tenant, property or title, in any case", () => {
    expect(matchesSearch(c, "12a")).toBe(true);
    expect(matchesSearch(c, "UNIT 12A")).toBe(true);
    expect(matchesSearch(c, "rudo")).toBe(true);
    expect(matchesSearch(c, "borrowdale")).toBe(true);
    expect(matchesSearch(c, "pipe")).toBe(true);
  });

  it("needs every typed word to match, in any order", () => {
    expect(matchesSearch(c, "heights 12a")).toBe(true);
    expect(matchesSearch(c, "12a avondale")).toBe(false);
  });

  it("matches everything for a blank search", () => {
    expect(matchesSearch(c, "")).toBe(true);
    expect(matchesSearch(c, "   ")).toBe(true);
  });

  it("copes with a complaint that has no property name", () => {
    expect(matchesSearch(item({ unit: { unitNumber: "3" } }), "unit 3")).toBe(true);
  });
});

describe("compareQueue", () => {
  it("puts a resolved CRITICAL complaint below an open MEDIUM one", () => {
    const resolvedCritical = item({ status: "RESOLVED", priority: "CRITICAL" });
    const openMedium = item({ status: "OPEN", priority: "MEDIUM" });
    expect([resolvedCritical, openMedium].sort(compareQueue)).toEqual([openMedium, resolvedCritical]);
  });

  it("orders active complaints by priority, then newest first", () => {
    const low = item({ priority: "LOW", day: 14 });
    const highOld = item({ priority: "HIGH", day: 1 });
    const highNew = item({ priority: "HIGH", day: 9 });
    const critical = item({ priority: "CRITICAL", status: "IN_PROGRESS", day: 2 });
    expect([low, highOld, highNew, critical].sort(compareQueue)).toEqual([critical, highNew, highOld, low]);
  });

  it("orders resolved complaints by the most recently touched, whatever their priority", () => {
    const old = item({ status: "CLOSED", priority: "CRITICAL" });
    const fresh = item({ status: "RESOLVED", priority: "LOW" });
    fresh.updatedAt = new Date(Date.UTC(2026, 9, 14, 8));
    expect([old, fresh].sort(compareQueue)).toEqual([fresh, old]);
  });

  it("breaks a full tie on id, the same way for any input order", () => {
    const a = item();
    const b = { ...item(), createdAt: a.createdAt, updatedAt: a.updatedAt };
    expect([a, b].sort(compareQueue).map((x) => x.id)).toEqual([b.id, a.id]);
    expect([b, a].sort(compareQueue).map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it("ranks an unknown priority last among active complaints", () => {
    const odd = item({ priority: "URGENT" });
    const low = item({ priority: "LOW" });
    expect([odd, low].sort(compareQueue)).toEqual([low, odd]);
  });
});

describe("dedupeById", () => {
  it("keeps one copy per id and prefers the one touched most recently", () => {
    const stale = item({ status: "OPEN" });
    const fresh = { ...stale, status: "RESOLVED", updatedAt: new Date(stale.updatedAt.getTime() + 60_000) };
    expect(dedupeById([stale, fresh])).toEqual([fresh]);
    expect(dedupeById([fresh, stale])).toEqual([fresh]);
  });

  it("keeps the first copy when both were touched at the same moment", () => {
    const first = item();
    const second = { ...first, title: "Same row again" };
    expect(dedupeById([first, second])[0].title).toBe(first.title);
  });
});

describe("buildQueue", () => {
  const openMedium = item({ status: "OPEN", priority: "MEDIUM" });
  const progressHigh = item({ status: "IN_PROGRESS", priority: "HIGH" });
  const resolvedCritical = item({ status: "RESOLVED", priority: "CRITICAL" });
  const closedLow = item({ status: "CLOSED", priority: "LOW" });
  const active = [openMedium, progressHigh];
  const resolved = [resolvedCritical, closedLow];

  it("shows only active complaints by default, most urgent first", () => {
    const list = buildQueue({ filter: "ACTIVE", query: "", active, resolved, activeHasMore: false });
    expect(list).toEqual([progressHigh, openMedium]);
  });

  it("narrows to open or in progress", () => {
    expect(buildQueue({ filter: "OPEN", query: "", active, resolved, activeHasMore: false })).toEqual([openMedium]);
    expect(buildQueue({ filter: "IN_PROGRESS", query: "", active, resolved, activeHasMore: false })).toEqual([progressHigh]);
  });

  it("shows resolved and closed complaints under Resolved", () => {
    const list = buildQueue({ filter: "RESOLVED", query: "", active, resolved, activeHasMore: true });
    expect(list.map((c) => c.id).sort()).toEqual([resolvedCritical.id, closedLow.id].sort());
  });

  it("lists every active complaint before any resolved one under All", () => {
    const list = buildQueue({ filter: "ALL", query: "", active, resolved, activeHasMore: false });
    expect(list.slice(0, 2)).toEqual([progressHigh, openMedium]);
    expect(list.slice(2)).toContain(resolvedCritical);
    expect(list).toHaveLength(4);
  });

  it("holds resolved complaints back under All while active pages are still on the server", () => {
    const list = buildQueue({ filter: "ALL", query: "", active, resolved, activeHasMore: true });
    expect(list).toEqual([progressHigh, openMedium]);
  });

  it("applies the search on top of the filter", () => {
    const geyser = item({ title: "Geyser tripped", tenantName: "Farai Ncube" });
    const list = buildQueue({ filter: "ACTIVE", query: "farai", active: [openMedium, geyser], resolved: [], activeHasMore: false });
    expect(list).toEqual([geyser]);
  });

  it("moves a complaint that was resolved a moment ago out of Active and into Resolved without waiting for a refetch", () => {
    const justResolved = { ...openMedium, status: "RESOLVED", updatedAt: new Date(openMedium.updatedAt.getTime() + 1000) };
    expect(buildQueue({ filter: "ACTIVE", query: "", active: [justResolved], resolved: [], activeHasMore: false })).toEqual([]);
    expect(buildQueue({ filter: "RESOLVED", query: "", active: [justResolved], resolved: [], activeHasMore: false })).toEqual([justResolved]);
  });
});

describe("nextFeed", () => {
  it("extends the active feed first, then the resolved one under All", () => {
    expect(nextFeed("ACTIVE", true, true)).toBe("ACTIVE");
    expect(nextFeed("ALL", true, true)).toBe("ACTIVE");
    expect(nextFeed("ALL", false, true)).toBe("RESOLVED");
    expect(nextFeed("ALL", false, false)).toBeNull();
  });

  it("extends only the resolved feed under Resolved", () => {
    expect(nextFeed("RESOLVED", true, true)).toBe("RESOLVED");
    expect(nextFeed("RESOLVED", true, false)).toBeNull();
  });

  it("never reaches for resolved complaints from the active filters", () => {
    expect(nextFeed("OPEN", false, true)).toBeNull();
    expect(nextFeed("IN_PROGRESS", false, true)).toBeNull();
  });
});

describe("needsResolvedFeed", () => {
  it("fetches resolved complaints only when they can be shown", () => {
    expect(needsResolvedFeed("RESOLVED", true)).toBe(true);
    expect(needsResolvedFeed("ALL", false)).toBe(true);
    expect(needsResolvedFeed("ALL", true)).toBe(false);
    expect(needsResolvedFeed("ACTIVE", false)).toBe(false);
  });
});

describe("queueLine", () => {
  it("spells out priority and status in capitals", () => {
    expect(queueLine("HIGH", "OPEN")).toBe("HIGH · OPEN");
    expect(queueLine("CRITICAL", "IN_PROGRESS")).toBe("CRITICAL · IN PROGRESS");
    expect(queueLine("LOW", "PENDING_PARTS")).toBe("LOW · PENDING PARTS");
    expect(queueLine("MEDIUM", "RESOLVED")).toBe("MEDIUM · RESOLVED");
  });

  it("never prints a raw enum with an underscore", () => {
    expect(queueLine("URGENT", "WAITING_ON_TENANT")).toBe("URGENT · WAITING ON TENANT");
  });
});

describe("describeEmpty", () => {
  const base = { query: "", loaded: 0, hasMore: false };

  it("says plainly that tenants report problems from their portal when there are none at all", () => {
    expect(describeEmpty({ ...base, filter: "ALL" }).hint).toMatch(/tenants report problems from their portal/i);
    expect(describeEmpty({ ...base, filter: "ACTIVE" }).hint).toMatch(/tenants report problems from their portal/i);
    expect(describeEmpty({ ...base, filter: "ALL" }).kind).toBe("none-yet");
  });

  it("tells the landlord they are all caught up on the active view", () => {
    const view = describeEmpty({ ...base, filter: "ACTIVE" });
    expect(view.kind).toBe("all-clear");
    expect(view.title).toBe("Nothing needs you right now");
  });

  it("names the search when nothing matches it", () => {
    const view = describeEmpty({ ...base, filter: "ACTIVE", query: "  geyser " });
    expect(view.kind).toBe("no-match");
    expect(view.title).toBe("Nothing matches “geyser”");
  });

  it("asks to load more instead of claiming there is nothing when more pages exist", () => {
    const view = describeEmpty({ ...base, filter: "OPEN", query: "geyser", loaded: 20, hasMore: true });
    expect(view.kind).toBe("keep-looking");
    expect(view.title).toContain("20 loaded");
    expect(view.hint).toMatch(/load more/i);
  });

  it("has an honest line for every filter", () => {
    for (const filter of QUEUE_FILTERS) {
      const view = describeEmpty({ ...base, filter });
      expect(view.title.length).toBeGreaterThan(0);
      expect(view.hint.length).toBeGreaterThan(0);
    }
  });
});
