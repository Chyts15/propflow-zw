import { describe, expect, it } from "vitest";
import { pagerHref, parseCursor } from "../pagination";

describe("parseCursor", () => {
  it("accepts an id-shaped value and takes the first of a repeated parameter", () => {
    expect(parseCursor("cmgq4x7f20001abcdefghijkl")).toBe("cmgq4x7f20001abcdefghijkl");
    expect(parseCursor(["cmgq4x7f20001abcdefghijkl", "other"])).toBe("cmgq4x7f20001abcdefghijkl");
  });

  it("ignores anything missing or not shaped like an id, so a bad link shows the first page", () => {
    expect(parseCursor(undefined)).toBeUndefined();
    expect(parseCursor("")).toBeUndefined();
    expect(parseCursor("1")).toBeUndefined();
    expect(parseCursor("not an id")).toBeUndefined();
    expect(parseCursor("c-bad-id-with-dashes")).toBeUndefined();
    expect(parseCursor("'; DROP TABLE users;--")).toBeUndefined();
    expect(parseCursor("c" + "a".repeat(80))).toBeUndefined();
  });
});

describe("pagerHref", () => {
  it("adds the cursor and keeps the other filters", () => {
    expect(pagerHref("/finances", { month: "2026-10" }, "cabc123456789")).toBe("/finances?month=2026-10&cursor=cabc123456789");
  });

  it("goes back to the first page by leaving the cursor out", () => {
    expect(pagerHref("/finances", { month: "2026-10" })).toBe("/finances?month=2026-10");
    expect(pagerHref("/properties", {})).toBe("/properties");
  });

  it("drops empty filters and escapes values", () => {
    expect(pagerHref("/finances", { month: undefined, q: "a b&c" }, "cabc123456789")).toBe(
      "/finances?q=a+b%26c&cursor=cabc123456789",
    );
  });
});
