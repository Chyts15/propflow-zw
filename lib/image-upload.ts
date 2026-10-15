// Decisions behind the tenant photo uploads (payment proof and complaint photos). Pure, so the
// size rules and the plain-language errors can be tested without a canvas or a network.
//
// The median tenant is on a budget Android over Econet data. A phone photo is 3 to 8 MB, which
// does not survive a weak connection, so every photo is shrunk to about 300 KB in the browser
// before it is sent. The browser-only parts (canvas, XHR) live in components/tenant/image-pipeline.ts.

import { tenantErrorMessage } from "./tenant-errors";

export const TARGET_BYTES = 300 * 1024;

/** No bytes moving for this long means the connection has stalled, so the upload is given up. */
export const STALL_TIMEOUT_MS = 45_000;

/** Presigned URLs live 5 minutes (lib/storage/r2.ts); reuse one on retry only while it is well inside that. */
export const PRESIGN_REUSE_MS = 4 * 60 * 1000;

/** Larger than this is refused before decoding: a huge original can exhaust a budget phone's memory. */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export type ImageContentType = "image/jpeg" | "image/png";

/** Plain-language reason a chosen file cannot be used at all, or null when it can be tried. */
export function rejectSource(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith("image/")) return "Choose a photo or a screenshot.";
  if (file.size > MAX_SOURCE_BYTES) return "That photo is too big. Take a screenshot of your payment instead.";
  return null;
}

/**
 * Encoding attempts, best quality first. The first one that fits the target wins; if none do the
 * smallest is used. 1600px on the long edge keeps the text of a phone screenshot readable.
 */
export const COMPRESSION_LADDER: readonly { maxEdge: number; quality: number }[] = [
  { maxEdge: 1600, quality: 0.82 },
  { maxEdge: 1600, quality: 0.7 },
  { maxEdge: 1280, quality: 0.7 },
  { maxEdge: 1280, quality: 0.6 },
  { maxEdge: 1024, quality: 0.6 },
  { maxEdge: 1024, quality: 0.5 },
  { maxEdge: 800, quality: 0.5 },
];

/** Scales to fit within maxEdge on the long side, keeping the ratio. Never enlarges. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.max(Math.round(width * scale), 1), height: Math.max(Math.round(height * scale), 1) };
}

/** A JPEG or PNG already at or under the target goes up untouched; everything else is re-encoded. */
export function needsCompression(file: { type: string; size: number }): boolean {
  const sendable = file.type === "image/jpeg" || file.type === "image/png";
  return !(sendable && file.size <= TARGET_BYTES);
}

/**
 * Walks the ladder, encoding one step at a time, and returns the first result at or under the
 * target, else the smallest produced. `encode` returns null when a step fails to produce anything.
 */
export async function compressWithLadder<T extends { size: number }>(
  encode: (step: { maxEdge: number; quality: number }) => Promise<T | null>,
  target = TARGET_BYTES,
): Promise<T | null> {
  let smallest: T | null = null;
  for (const step of COMPRESSION_LADDER) {
    const result = await encode(step);
    if (!result) continue;
    if (result.size <= target) return result;
    if (!smallest || result.size < smallest.size) smallest = result;
  }
  return smallest;
}

export function isPresignFresh(obtainedAt: number, now: number): boolean {
  return now - obtainedAt < PRESIGN_REUSE_MS;
}

export type UploadErrorKind = "timeout" | "network" | "rejected" | "unreadable" | "aborted";

export class UploadError extends Error {
  constructor(
    public readonly kind: UploadErrorKind,
    public readonly status?: number,
  ) {
    super(kind);
    this.name = "UploadError";
  }
}

/** What to tell a tenant when a photo did not go up. Always says the photo is still there to retry. */
export function describeUploadError(err: unknown): string {
  if (err instanceof UploadError) {
    switch (err.kind) {
      case "timeout":
        return "The connection stalled. Tap Retry, your photo is still here.";
      case "network":
        return "You lost your connection. Tap Retry when you're back online, your photo is still here.";
      case "rejected":
        return err.status === 403
          ? "The upload link expired. Tap Retry, your photo is still here."
          : "The photo didn't go through. Tap Retry, your photo is still here.";
      case "unreadable":
        return "We couldn't read that photo. Try a screenshot or a JPEG picture.";
      case "aborted":
        return "";
    }
  }
  const message = err instanceof Error ? err.message : "";
  // The server throws this on purpose when R2 credentials are not set (lib/routers/rent.ts and complaints.ts).
  if (/r2 credentials missing|uploads are not configured/i.test(message)) {
    return "Photo uploads aren't switched on yet. That's on our side, not yours. Please try again later, or show your landlord your payment message directly.";
  }
  return tenantErrorMessage({ message }, "The photo didn't go through. Tap Retry, your photo is still here.");
}

export function formatKb(bytes: number): string {
  return `${Math.max(Math.round(bytes / 1024), 1).toLocaleString("en-US")} KB`;
}
