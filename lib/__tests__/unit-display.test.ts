import { describe, expect, it } from "vitest";
import { compareUnitNumbers, isJustCreated, nextUnitNumber, occupancySummary, unitLabel } from "../unit-display";

describe("unitLabel", () => {
  it("reads 'Unit 04 · Borrowdale Flats'", () => {
    expect(unitLabel({ unitNumber: "04", propertyName: "Borrowdale Flats" })).toBe("Unit 04 · Borrowdale Flats");
  });
});

describe("compareUnitNumbers", () => {
  it("puts 2 before 10 and keeps 4 before 4A", () => {
    expect(["10", "4A", "2", "1", "4"].sort(compareUnitNumbers)).toEqual(["1", "2", "4", "4A", "10"]);
    expect(["B2", "A10", "A2"].sort(compareUnitNumbers)).toEqual(["A2", "A10", "B2"]);
    expect(compareUnitNumbers("02", "10")).toBeLessThan(0);
  });
});

describe("nextUnitNumber", () => {
  it("counts on and keeps the zero padding", () => {
    expect(nextUnitNumber("04")).toBe("05");
    expect(nextUnitNumber("09")).toBe("10");
    expect(nextUnitNumber("9")).toBe("10");
    expect(nextUnitNumber("099")).toBe("100");
  });

  it("keeps a letter prefix", () => {
    expect(nextUnitNumber("A12")).toBe("A13");
    expect(nextUnitNumber("Flat 7")).toBe("Flat 8");
  });

  it("offers nothing when the number doesn't end in digits", () => {
    expect(nextUnitNumber("4B")).toBe("");
    expect(nextUnitNumber("Cottage")).toBe("");
    expect(nextUnitNumber("")).toBe("");
  });
});

describe("occupancySummary", () => {
  it("says a property with no units is empty, never 0/0", () => {
    expect(occupancySummary([])).toEqual({ kind: "empty" });
  });

  it("counts occupied units and the percentage", () => {
    expect(occupancySummary([{ isVacant: false }, { isVacant: true }, { isVacant: false }])).toEqual({
      kind: "units",
      occupied: 2,
      total: 3,
      pct: 67,
    });
    expect(occupancySummary([{ isVacant: true }])).toEqual({ kind: "units", occupied: 0, total: 1, pct: 0 });
  });
});

describe("isJustCreated", () => {
  const now = Date.UTC(2026, 5, 22, 10, 0, 0);

  it("is true inside the window and false after it", () => {
    expect(isJustCreated(new Date(now - 2_000), now)).toBe(true);
    expect(isJustCreated(now - 7_999, now)).toBe(true);
    expect(isJustCreated(new Date(now - 8_000), now)).toBe(false);
    expect(isJustCreated(new Date(now - 60_000), now)).toBe(false);
  });

  it("ignores a creation time in the future (clock skew)", () => {
    expect(isJustCreated(now + 5_000, now)).toBe(false);
  });
});
