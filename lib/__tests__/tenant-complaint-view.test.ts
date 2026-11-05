import { describe, expect, it } from "vitest";
import { previewText, replyLabel, senderLabel } from "../tenant-complaint-view";

describe("replyLabel", () => {
  it("says nothing when the landlord has not replied", () => {
    expect(replyLabel(0)).toBeNull();
    expect(replyLabel(-1)).toBeNull();
  });

  it("counts the landlord's replies", () => {
    expect(replyLabel(1)).toBe("1 reply from your landlord");
    expect(replyLabel(3)).toBe("3 replies from your landlord");
  });
});

describe("previewText", () => {
  it("leaves a short reply as it is", () => {
    expect(previewText("The plumber is coming on Thursday.")).toBe("The plumber is coming on Thursday.");
  });

  it("puts a multi-line reply on one line", () => {
    expect(previewText("Hello Chipo,\n\n  the plumber   comes\tThursday.")).toBe("Hello Chipo, the plumber comes Thursday.");
  });

  it("cuts a long reply at the limit with an ellipsis, never longer than the limit", () => {
    const out = previewText("a".repeat(300), 100);
    expect(out).toBe(`${"a".repeat(99)}…`);
    expect(Array.from(out)).toHaveLength(100);
  });

  it("does not split a character made of two code units", () => {
    const out = previewText("😀".repeat(10), 5);
    expect(out).toBe("😀😀😀😀…");
  });

  it("does not leave a space before the ellipsis", () => {
    expect(previewText("one two three four", 9)).toBe("one two…");
  });
});

describe("senderLabel", () => {
  it("names who sent a message the way the tenant reads it", () => {
    expect(senderLabel("LANDLORD")).toBe("Your landlord");
    expect(senderLabel("TENANT")).toBe("You");
    expect(senderLabel("ADMIN")).toBe("PropFlow");
  });
});
