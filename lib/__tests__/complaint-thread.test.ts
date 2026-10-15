import { describe, expect, it } from "vitest";
import {
  REPLY_MAX,
  dayBreaks,
  formatClock,
  isSendable,
  mergeMessages,
  needsUndo,
  parsePriority,
  parseStatus,
  restoreDraft,
  shouldSendOnKey,
  slaLabel,
  slaStatus,
  telHref,
  type ThreadMessage,
} from "../complaint-thread";

const HOUR = 60 * 60 * 1000;

describe("parseStatus / parsePriority", () => {
  it("accepts only values the server knows", () => {
    expect(parseStatus("PENDING_PARTS")).toBe("PENDING_PARTS");
    expect(parseStatus("DONE")).toBeNull();
    expect(parsePriority("CRITICAL")).toBe("CRITICAL");
    expect(parsePriority("critical")).toBeNull();
  });
});

describe("needsUndo", () => {
  it("offers an undo for the two statuses that tell the tenant a complaint is done", () => {
    expect(needsUndo("RESOLVED")).toBe(true);
    expect(needsUndo("CLOSED")).toBe(true);
    expect(needsUndo("IN_PROGRESS")).toBe(false);
    expect(needsUndo("OPEN")).toBe(false);
  });
});

describe("slaStatus", () => {
  const created = new Date("2026-10-12T08:00:00Z");

  it("counts hours left inside a day and days beyond it", () => {
    expect(slaStatus(created, "CRITICAL", false, new Date(created.getTime() + 18 * HOUR))).toEqual({ overdue: false, text: "6h" });
    expect(slaStatus(created, "LOW", false, new Date(created.getTime() + 24 * HOUR))).toEqual({ overdue: false, text: "6d" });
  });

  it("flags a complaint past its deadline", () => {
    expect(slaStatus(created, "CRITICAL", false, new Date(created.getTime() + 24 * HOUR + 3 * HOUR))).toEqual({ overdue: true, text: "3h" });
    expect(slaStatus(created, "HIGH", false, new Date(created.getTime() + 5 * 24 * HOUR))).toEqual({ overdue: true, text: "3d" });
  });

  it("never says 0h", () => {
    expect(slaStatus(created, "CRITICAL", false, new Date(created.getTime() + 24 * HOUR - 10 * 60 * 1000))).toEqual({ overdue: false, text: "<1h" });
  });

  it("has no clock once the complaint is resolved", () => {
    expect(slaStatus(created, "CRITICAL", true, new Date(created.getTime() + 99 * HOUR))).toBeNull();
  });

  it("falls back to 72 hours for a priority it does not know", () => {
    expect(slaStatus(created, "URGENT", false, new Date(created.getTime() + 50 * HOUR))).toEqual({ overdue: false, text: "22h" });
  });

  it("words the clock plainly", () => {
    expect(slaLabel({ overdue: true, text: "3d" })).toBe("Overdue by 3d");
    expect(slaLabel({ overdue: false, text: "6h" })).toBe("6h left to respond");
  });
});

describe("formatClock", () => {
  it("shows Zimbabwe time on a 24 hour clock", () => {
    expect(formatClock(new Date("2026-10-14T12:32:00Z"))).toBe("14:32");
    expect(formatClock(new Date("2026-10-14T22:05:00Z"))).toBe("00:05");
  });
});

describe("dayBreaks", () => {
  it("labels the first moment and each new Zimbabwe day with the long date", () => {
    const labels = dayBreaks([
      new Date("2026-10-14T06:00:00Z"),
      new Date("2026-10-14T09:30:00Z"),
      new Date("2026-10-15T07:00:00Z"),
    ]);
    expect(labels).toEqual(["Wednesday, 14 October 2026", null, "Thursday, 15 October 2026"]);
  });

  it("starts a new day at midnight in Harare, not at midnight UTC", () => {
    const labels = dayBreaks([new Date("2026-10-14T21:30:00Z"), new Date("2026-10-14T22:30:00Z")]);
    expect(labels).toEqual(["Wednesday, 14 October 2026", "Thursday, 15 October 2026"]);
  });

  it("returns nothing for no messages", () => {
    expect(dayBreaks([])).toEqual([]);
  });
});

describe("mergeMessages", () => {
  const msg = (id: string, minutes: number): ThreadMessage => ({
    id,
    senderRole: "LANDLORD",
    senderName: "Farai Ncube",
    body: id,
    imageUrls: [],
    createdAt: new Date(Date.UTC(2026, 9, 14, 8, minutes)),
  });

  it("adds replies the server has not returned yet, in time order", () => {
    const merged = mergeMessages([msg("a", 0), msg("b", 5)], [msg("local-1", 9)]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "local-1"]);
  });

  it("drops a local reply once the server's page contains it", () => {
    const merged = mergeMessages([msg("a", 0), msg("b", 5)], [msg("b", 5)]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("does not mutate its inputs", () => {
    const server = [msg("b", 5), msg("a", 0)];
    mergeMessages(server, []);
    expect(server.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("reply box", () => {
  it("only sends something that is not blank and fits the limit", () => {
    expect(isSendable("")).toBe(false);
    expect(isSendable("  \n ")).toBe(false);
    expect(isSendable("The plumber comes on Friday.")).toBe(true);
    expect(isSendable("a".repeat(REPLY_MAX))).toBe(true);
    expect(isSendable("a".repeat(REPLY_MAX + 1))).toBe(false);
  });

  it("sends on Enter, keeps Shift+Enter for a new line, and ignores Enter while composing", () => {
    expect(shouldSendOnKey({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
    expect(shouldSendOnKey({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
    expect(shouldSendOnKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
    expect(shouldSendOnKey({ key: "a", shiftKey: false, isComposing: false })).toBe(false);
  });

  it("puts a failed reply back ahead of whatever was typed since", () => {
    expect(restoreDraft("", "Plumber on Friday")).toBe("Plumber on Friday");
    expect(restoreDraft("   ", "Plumber on Friday")).toBe("Plumber on Friday");
    expect(restoreDraft("And bring tools", "Plumber on Friday")).toBe("Plumber on Friday\nAnd bring tools");
  });
});

describe("telHref", () => {
  it("dials Zimbabwe mobiles in international form, however they were stored", () => {
    expect(telHref("+263771234567")).toBe("tel:+263771234567");
    expect(telHref("0771234567")).toBe("tel:+263771234567");
    expect(telHref("077 123 4567")).toBe("tel:+263771234567");
    expect(telHref("263 77 123 4567")).toBe("tel:+263771234567");
  });

  it("keeps other numbers diallable without guessing at them", () => {
    expect(telHref("+27 82 123 4567")).toBe("tel:+27821234567");
    expect(telHref("0242 700 123")).toBe("tel:0242700123");
  });

  it("returns null when there is nothing to dial", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref("n/a")).toBeNull();
    expect(telHref("12")).toBeNull();
  });
});
