import { describe, expect, it } from "vitest";
import { formatZwPhone } from "../phone";

describe("formatZwPhone", () => {
  it("formats every common way a Zimbabwe mobile number is stored", () => {
    for (const raw of ["+263771234567", "263771234567", "0771234567", "771234567", "+263 77 123 4567", "077-123-4567"]) {
      expect(formatZwPhone(raw)).toBe("+263 77 123 4567");
    }
  });

  it("formats the other mobile prefixes", () => {
    expect(formatZwPhone("+263712345678")).toBe("+263 71 234 5678");
    expect(formatZwPhone("0782345678")).toBe("+263 78 234 5678");
  });

  it("leaves anything else as it was, trimmed", () => {
    expect(formatZwPhone("  +27821234567 ")).toBe("+27821234567");
    expect(formatZwPhone("0242 700 000")).toBe("0242 700 000");
    expect(formatZwPhone("")).toBe("");
  });
});
