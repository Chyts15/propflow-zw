import { describe, expect, it } from "vitest";
import {
  COMPRESSION_LADDER,
  PRESIGN_REUSE_MS,
  TARGET_BYTES,
  UploadError,
  compressWithLadder,
  describeUploadError,
  fitWithin,
  formatKb,
  isPresignFresh,
  MAX_SOURCE_BYTES,
  needsCompression,
  rejectSource,
} from "../image-upload";

describe("fitWithin", () => {
  it("shrinks the long edge and keeps the ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 2400, 1600)).toEqual({ width: 720, height: 1600 });
  });

  it("never enlarges an image that already fits", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1000, 1600)).toEqual({ width: 1600, height: 1000 });
  });

  it("never collapses a thin image to zero", () => {
    expect(fitWithin(10000, 2, 1000)).toEqual({ width: 1000, height: 1 });
  });
});

describe("needsCompression", () => {
  it("sends a small JPEG or PNG untouched", () => {
    expect(needsCompression({ type: "image/jpeg", size: 120 * 1024 })).toBe(false);
    expect(needsCompression({ type: "image/png", size: TARGET_BYTES })).toBe(false);
  });

  it("re-encodes anything over the target, even a JPEG", () => {
    expect(needsCompression({ type: "image/jpeg", size: TARGET_BYTES + 1 })).toBe(true);
    expect(needsCompression({ type: "image/png", size: 4 * 1024 * 1024 })).toBe(true);
  });

  it("converts formats the server does not accept, however small", () => {
    expect(needsCompression({ type: "image/webp", size: 50 * 1024 })).toBe(true);
    expect(needsCompression({ type: "image/heic", size: 50 * 1024 })).toBe(true);
  });
});

describe("rejectSource", () => {
  it("accepts any image the browser might be able to read", () => {
    expect(rejectSource({ type: "image/jpeg", size: 5_000_000 })).toBeNull();
    expect(rejectSource({ type: "image/webp", size: 100 })).toBeNull();
  });

  it("refuses things that are not pictures", () => {
    expect(rejectSource({ type: "application/pdf", size: 100 })).toMatch(/photo or a screenshot/);
    expect(rejectSource({ type: "", size: 100 })).toMatch(/photo or a screenshot/);
  });

  it("refuses an original so big it could exhaust the phone's memory", () => {
    expect(rejectSource({ type: "image/jpeg", size: MAX_SOURCE_BYTES + 1 })).toMatch(/too big/);
    expect(rejectSource({ type: "image/jpeg", size: MAX_SOURCE_BYTES })).toBeNull();
  });
});

describe("compressWithLadder", () => {
  const sizesFor = (sizes: number[]) => {
    const calls: { maxEdge: number; quality: number }[] = [];
    const encode = async (step: { maxEdge: number; quality: number }) => {
      calls.push(step);
      return { size: sizes[calls.length - 1] ?? sizes[sizes.length - 1] };
    };
    return { encode, calls };
  };

  it("stops at the first step that fits", async () => {
    const { encode, calls } = sizesFor([900_000, 400_000, 250_000, 100_000]);
    const result = await compressWithLadder(encode);
    expect(result).toEqual({ size: 250_000 });
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(COMPRESSION_LADDER[0]);
  });

  it("settles for the smallest when nothing reaches the target", async () => {
    const { encode, calls } = sizesFor([900_000, 700_000, 650_000, 800_000, 600_000, 610_000, 620_000]);
    const result = await compressWithLadder(encode);
    expect(result).toEqual({ size: 600_000 });
    expect(calls).toHaveLength(COMPRESSION_LADDER.length);
  });

  it("skips a step that produced nothing", async () => {
    let n = 0;
    const result = await compressWithLadder(async () => (++n === 1 ? null : { size: 100 }));
    expect(result).toEqual({ size: 100 });
  });

  it("returns null when no step produces anything", async () => {
    expect(await compressWithLadder(async () => null)).toBeNull();
  });

  it("walks from large and good to small and rough", () => {
    for (let i = 1; i < COMPRESSION_LADDER.length; i++) {
      const prev = COMPRESSION_LADDER[i - 1];
      const step = COMPRESSION_LADDER[i];
      expect(step.maxEdge <= prev.maxEdge).toBe(true);
      expect(step.quality <= prev.quality || step.maxEdge < prev.maxEdge).toBe(true);
    }
  });
});

describe("isPresignFresh", () => {
  it("reuses an upload link only while it is comfortably inside its 5 minute life", () => {
    expect(isPresignFresh(1_000, 1_000 + PRESIGN_REUSE_MS - 1)).toBe(true);
    expect(isPresignFresh(1_000, 1_000 + PRESIGN_REUSE_MS)).toBe(false);
  });
});

describe("describeUploadError", () => {
  it("says the photo is still there when the connection stalls or drops", () => {
    expect(describeUploadError(new UploadError("timeout"))).toMatch(/stalled.*still here/);
    expect(describeUploadError(new UploadError("network"))).toMatch(/lost your connection.*still here/);
  });

  it("explains an expired link", () => {
    expect(describeUploadError(new UploadError("rejected", 403))).toMatch(/expired/);
    expect(describeUploadError(new UploadError("rejected", 500))).toMatch(/didn't go through/);
  });

  it("asks for a different photo when the file cannot be read", () => {
    expect(describeUploadError(new UploadError("unreadable"))).toMatch(/couldn't read/);
  });

  it("turns the server's R2 message into plain language", () => {
    const message = describeUploadError(new Error("File uploads are not configured yet (R2 credentials missing)"));
    expect(message).toMatch(/aren't switched on yet/);
    expect(message).toMatch(/not yours/);
    expect(message).not.toMatch(/R2|credentials/);
  });

  it("passes the friendly tRPC wording through", () => {
    expect(describeUploadError(new Error("Failed to fetch"))).toMatch(/Couldn't reach PropFlow/);
    expect(describeUploadError(new Error("Too many uploads — try again later"))).toBe("Too many uploads — try again later");
    expect(describeUploadError(new Error('[{"code":"too_big"}]'))).toMatch(/details look wrong/);
  });

  it("tells a tenant whose session ended to sign in, instead of showing a bare code", () => {
    expect(describeUploadError(new Error("UNAUTHORIZED"))).toMatch(/sign in again/);
  });

  it("falls back for something unknown", () => {
    expect(describeUploadError("weird")).toMatch(/Tap Retry/);
  });
});

describe("formatKb", () => {
  it("rounds to whole kilobytes and never says 0", () => {
    expect(formatKb(214_000)).toBe("209 KB");
    expect(formatKb(10)).toBe("1 KB");
    expect(formatKb(2_000_000)).toBe("1,953 KB");
  });
});
