import { describe, expect, it } from "vitest";
import { CLIENT_CUID, UUID_V4, idForAttempt, newComplaintId, newMessageId } from "../message-id";

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

describe("newComplaintId", () => {
  it("is the shape the router accepts, from a secure source or without one", () => {
    expect(newComplaintId()).toMatch(CLIENT_CUID);
    expect(newComplaintId(undefined)).toMatch(CLIENT_CUID);
    expect(
      newComplaintId({
        getRandomValues: (array) => {
          (array as Uint8Array).fill(0xff);
          return array;
        },
      }),
    ).toBe("cffffffffffffffffffffffff");
  });

  it("is also a valid cuid for the checks every other complaint procedure makes", async () => {
    const { z } = await import("zod");
    expect(z.string().cuid().safeParse(newComplaintId()).success).toBe(true);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newComplaintId()));
    expect(ids.size).toBe(500);
  });

  it("is not accepted from a client in any other shape", () => {
    for (const bad of ["", "c", "C0123456789abcdef01234567", "c0123456789abcdef0123456", "c0123456789abcdef012345678", "c0123456789ABCDEF01234567", "../etc/passwd", "11111111-1111-4111-8111-111111111111"]) {
      expect(CLIENT_CUID.test(bad), bad).toBe(false);
    }
  });
});

describe("idForAttempt", () => {
  const made = () => "fresh-id";

  it("starts something new with a new id", () => {
    expect(idForAttempt(null, "The tap is fixed", made)).toBe("fresh-id");
  });

  it("sends the same content under the same id, so a retry of a lost response is one send", () => {
    expect(idForAttempt({ id: "first-id", content: "The tap is fixed" }, "The tap is fixed", made)).toBe("first-id");
  });

  it("gives edited content a new id, since it is something different", () => {
    expect(idForAttempt({ id: "first-id", content: "The tap is fixed" }, "The tap is fixed today", made)).toBe("fresh-id");
  });
});
