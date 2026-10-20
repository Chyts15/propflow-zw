import { describe, expect, it } from "vitest";
import { UUID_V4, idForReply, newMessageId } from "../message-id";

describe("newMessageId", () => {
  it("uses the browser's randomUUID when there is one", () => {
    expect(newMessageId({ randomUUID: () => "11111111-1111-4111-8111-111111111111" })).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("builds a version 4 id from getRandomValues on a phone without randomUUID", () => {
    const id = newMessageId({
      getRandomValues: (array) => {
        (array as Uint8Array).fill(0xff);
        return array;
      },
    });
    expect(id).toMatch(UUID_V4);
    // The version and variant bits are forced whatever the random bytes were.
    expect(id[14]).toBe("4");
    expect("89ab").toContain(id[19]);
  });

  it("still returns a valid id with no secure random source at all", () => {
    expect(newMessageId(undefined)).toMatch(UUID_V4);
    expect(newMessageId({})).toMatch(UUID_V4);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newMessageId()));
    expect(ids.size).toBe(500);
  });
});

describe("idForReply", () => {
  const made = () => "fresh-id";

  it("starts a new reply with a new id", () => {
    expect(idForReply(null, "The tap is fixed", made)).toBe("fresh-id");
  });

  it("sends the same words under the same id, so a retry of a lost response is one reply", () => {
    expect(idForReply({ id: "first-id", body: "The tap is fixed" }, "The tap is fixed", made)).toBe("first-id");
  });

  it("gives edited words a new id, since they are a different reply", () => {
    expect(idForReply({ id: "first-id", body: "The tap is fixed" }, "The tap is fixed today", made)).toBe("fresh-id");
  });
});
