// Browser-only half of the tenant photo uploads: shrinking a photo with a canvas and sending it
// with progress. The decisions (sizes, ladder, error wording) are pure and tested in
// lib/image-upload.ts; this file only does the work the browser has to do.

import {
  STALL_TIMEOUT_MS,
  UploadError,
  compressWithLadder,
  fitWithin,
  needsCompression,
  type ImageContentType,
} from "@/lib/image-upload";

export type PreparedImage = { blob: Blob; contentType: ImageContentType };

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  try {
    if (typeof createImageBitmap === "function") {
      // Honours the photo's EXIF rotation, so a portrait photo isn't sent sideways.
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    }
    const url = URL.createObjectURL(file);
    const release = () => URL.revokeObjectURL(url);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, release };
    } catch (err) {
      release();
      throw err;
    }
  } catch {
    throw new UploadError("unreadable");
  }
}

function encodeJpeg(decoded: Decoded, maxEdge: number, quality: number): Promise<Blob | null> {
  const { width, height } = fitWithin(decoded.width, decoded.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  // A PNG screenshot can be transparent; JPEG has no alpha and would turn that black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(decoded.source, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        // Hand the canvas's memory back straight away: budget phones have little to spare.
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Shrinks a photo to about 300 KB as a JPEG, or passes a small JPEG/PNG through untouched. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!needsCompression(file)) return { blob: file, contentType: file.type as ImageContentType };

  const decoded = await decode(file);
  try {
    const blob = await compressWithLadder(async ({ maxEdge, quality }) => encodeJpeg(decoded, maxEdge, quality));
    if (!blob) throw new UploadError("unreadable");
    return { blob, contentType: "image/jpeg" };
  } finally {
    decoded.release();
  }
}

/**
 * PUTs a blob to a presigned URL with real progress (fetch cannot report upload progress). The
 * timeout is a stall timeout: it fires after STALL_TIMEOUT_MS with no bytes moving, and every
 * progress event resets it. A fixed total deadline would kill a slow but healthy 2G upload.
 */
export function putBlob(
  url: string,
  blob: Blob,
  contentType: ImageContentType,
  { onProgress, signal }: { onProgress: (fraction: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadError("aborted"));

    const xhr = new XMLHttpRequest();
    let stalled = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;

    const armStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        stalled = true;
        xhr.abort();
      }, STALL_TIMEOUT_MS);
    };
    const onAbort = () => xhr.abort();
    const finish = (fn: () => void) => {
      clearTimeout(stallTimer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    signal?.addEventListener("abort", onAbort);

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      armStallTimer();
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(e.loaded / e.total, 1));
    };
    xhr.onload = () =>
      finish(() => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError("rejected", xhr.status))));
    xhr.onerror = () => finish(() => reject(new UploadError("network")));
    xhr.onabort = () => finish(() => reject(new UploadError(stalled ? "timeout" : "aborted")));

    armStallTimer();
    xhr.send(blob);
  });
}
