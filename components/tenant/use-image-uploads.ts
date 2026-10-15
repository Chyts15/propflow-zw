"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareImage, putBlob } from "@/components/tenant/image-pipeline";
import {
  UploadError,
  describeUploadError,
  isPresignFresh,
  type ImageContentType,
} from "@/lib/image-upload";

// One place that owns a photo's journey: shrink it, ask the server for an upload link, send it with
// progress, and keep every chosen photo in memory until it is sent or removed. That last part is what
// makes Retry cheap on a bad connection: it resumes from where the photo failed (no second compress,
// no second file pick), and reuses the upload link while that is still valid.
//
// Used by the payment-proof form (one photo) and the complaint form (up to three).

export type UploadItem = {
  id: number;
  status: "preparing" | "uploading" | "done" | "failed";
  /** 0 to 1 while uploading. */
  progress: number;
  /** Object URL of what will be sent, so nothing is downloaded back from storage. */
  previewUrl: string | null;
  /** Size of what will be sent, once known. */
  sizeBytes: number | null;
  /** The stored file's address, once it is uploaded. */
  publicUrl: string | null;
  error: string | null;
  /** False when trying the same photo again cannot help (it could not be read). */
  retryable: boolean;
};

type RequestUploadUrl = (input: {
  contentType: ImageContentType;
  contentLength: number;
}) => Promise<{ uploadUrl: string; publicUrl: string }>;

type Job = {
  file: File;
  blob: Blob | null;
  contentType: ImageContentType;
  presigned: { uploadUrl: string; publicUrl: string; at: number } | null;
  previewUrl: string | null;
  controller: AbortController | null;
};

export function useImageUploads({ requestUploadUrl, max }: { requestUploadUrl: RequestUploadUrl; max: number }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const jobs = useRef(new Map<number, Job>());
  const nextId = useRef(1);
  const requestRef = useRef(requestUploadUrl);

  useEffect(() => {
    requestRef.current = requestUploadUrl;
  });

  const patch = useCallback((id: number, changes: Partial<UploadItem>) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const dispose = useCallback((id: number) => {
    const job = jobs.current.get(id);
    if (!job) return;
    job.controller?.abort();
    if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
    jobs.current.delete(id);
  }, []);

  const run = useCallback(
    async (id: number) => {
      const job = jobs.current.get(id);
      if (!job) return;
      try {
        if (!job.blob) {
          patch(id, { status: "preparing", progress: 0, error: null, retryable: true });
          const prepared = await prepareImage(job.file);
          if (jobs.current.get(id) !== job) return; // removed while shrinking
          job.blob = prepared.blob;
          job.contentType = prepared.contentType;
          job.previewUrl = URL.createObjectURL(prepared.blob);
          patch(id, { previewUrl: job.previewUrl, sizeBytes: prepared.blob.size });
        }

        patch(id, { status: "uploading", progress: 0, error: null });
        if (!job.presigned || !isPresignFresh(job.presigned.at, Date.now())) {
          const link = await requestRef.current({ contentType: job.contentType, contentLength: job.blob.size });
          if (jobs.current.get(id) !== job) return;
          job.presigned = { ...link, at: Date.now() };
        }

        job.controller = new AbortController();
        await putBlob(job.presigned.uploadUrl, job.blob, job.contentType, {
          signal: job.controller.signal,
          onProgress: (progress) => patch(id, { progress }),
        });
        job.controller = null;
        patch(id, { status: "done", progress: 1, publicUrl: job.presigned.publicUrl, error: null });
      } catch (err) {
        if (jobs.current.get(id) !== job) return; // removed: nothing to report
        if (err instanceof UploadError) {
          if (err.kind === "aborted") return;
          // A refused link (expired) must not be reused by the next attempt.
          if (err.kind === "rejected") job.presigned = null;
        }
        job.controller = null;
        patch(id, {
          status: "failed",
          error: describeUploadError(err),
          retryable: !(err instanceof UploadError && err.kind === "unreadable"),
        });
      }
    },
    [patch],
  );

  /** Starts a photo on its way. With max 1 a new photo replaces the old one. Returns false when full. */
  const add = useCallback(
    (file: File): boolean => {
      if (max === 1) {
        for (const id of [...jobs.current.keys()]) dispose(id);
        setItems([]);
      } else if (jobs.current.size >= max) {
        return false;
      }
      const id = nextId.current++;
      jobs.current.set(id, { file, blob: null, contentType: "image/jpeg", presigned: null, previewUrl: null, controller: null });
      setItems((list) => [
        ...list,
        { id, status: "preparing", progress: 0, previewUrl: null, sizeBytes: null, publicUrl: null, error: null, retryable: true },
      ]);
      void run(id);
      return true;
    },
    [dispose, max, run],
  );

  const retry = useCallback((id: number) => void run(id), [run]);

  const remove = useCallback(
    (id: number) => {
      dispose(id);
      setItems((list) => list.filter((item) => item.id !== id));
    },
    [dispose],
  );

  // Leaving the page abandons any upload in flight and frees the previews.
  useEffect(() => {
    const live = jobs.current;
    return () => {
      for (const id of [...live.keys()]) dispose(id);
    };
  }, [dispose]);

  return { items, add, retry, remove };
}
