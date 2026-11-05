import { describe, expect, it } from "vitest";
import { formatLongDate, formatMonthName } from "../dates";
import { ymd } from "../rent-timing";

describe("formatLongDate", () => {
  it("uses the house format for a calendar day", () => {
    expect(formatLongDate(ymd(2026, 6, 22))).toBe("Monday, 22 June 2026");
    expect(formatLongDate(ymd(2026, 10, 5))).toBe("Monday, 5 October 2026");
  });

  it("uses Zimbabwe time for a moment, so late evening UTC is already tomorrow in Harare", () => {
    expect(formatLongDate(new Date("2026-06-21T23:30:00Z"))).toBe("Monday, 22 June 2026");
  });
});

describe("formatMonthName", () => {
  it("names a 1-based month", () => {
    expect(formatMonthName(9)).toBe("September");
  });
});
