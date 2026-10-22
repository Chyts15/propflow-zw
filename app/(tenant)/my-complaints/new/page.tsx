"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Wrench, Zap, Droplets, Shield, Building2, MoreHorizontal, Camera, X, RotateCw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { tenantErrorMessage } from "@/lib/tenant-errors";
import { rejectSource } from "@/lib/image-upload";
import { idForAttempt, newComplaintId, type UnconfirmedAttempt } from "@/lib/message-id";
import { Bone } from "@/components/tenant/skeletons";
import { TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";
import { useImageUploads } from "@/components/tenant/use-image-uploads";

const CATEGORIES = [
  { value: "Plumbing", icon: Wrench },
  { value: "Electrical", icon: Zap },
  { value: "Water/Borehole", icon: Droplets },
  { value: "Security", icon: Shield },
  { value: "Structure", icon: Building2 },
  { value: "Other", icon: MoreHorizontal },
] as const;

const MAX_PHOTOS = 3;

export default function NewComplaintPage() {
  const t = TENANT_DARK;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The id a submission went out under while it is unconfirmed. Submitting the same complaint again
  // after a lost response reuses it, so the landlord is not sent the same problem twice.
  const unconfirmed = useRef<UnconfirmedAttempt | null>(null);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessOk, setAccessOk] = useState<boolean | null>(null);

  const getUploadUrl = trpc.complaints.getUploadUrl.useMutation();
  const { items: photos, add, retry, remove } = useImageUploads({
    requestUploadUrl: (input) => getUploadUrl.mutateAsync(input),
    max: MAX_PHOTOS,
  });

  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: () => {
      unconfirmed.current = null;
      toast.success("Complaint sent. You can follow it in your complaints list.");
      router.push("/my-complaints");
    },
    onError: (err) => toast.error(tenantErrorMessage(err)),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same photo again still fires
    if (!file) return;
    const problem = rejectSource(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    add(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return toast.error("Choose a category");
    if (!title.trim()) return toast.error("Add a short title");
    if (!description.trim()) return toast.error("Describe the issue");
    if (accessOk === null) return toast.error("Let us know if the landlord needs access");
    if (photos.some((p) => p.status === "preparing" || p.status === "uploading")) return toast.error("Wait for your photos to finish sending");
    if (photos.some((p) => p.status === "failed")) return toast.error("A photo didn't send. Tap it to retry, or remove it.");

    const fields = {
      category,
      title,
      description: `${description}${accessOk ? "" : "\n\n(Tenant declined access permission.)"}`,
      imageUrls: photos.flatMap((p) => (p.publicUrl ? [p.publicUrl] : [])),
    };
    const content = JSON.stringify(fields);
    const complaintId = idForAttempt(unconfirmed.current, content, newComplaintId);
    unconfirmed.current = { id: complaintId, content };
    createComplaint.mutate({ complaintId, ...fields });
  }

  const failed = photos.find((p) => p.status === "failed");

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        Report an Issue
      </h1>
      <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
        Tell us what&apos;s wrong. Your landlord sees it in their PropFlow complaints list, and you can follow it in yours.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            CATEGORY
          </p>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={`press flex min-h-11 flex-col items-center gap-2 rounded-2xl p-4 ${TENANT_FOCUS_RING}`}
                style={{
                  backgroundColor: t.cardBg,
                  border: `1.5px solid ${category === value ? t.accent : t.cardBorder}`,
                  color: category === value ? t.accentLight : t.fgMuted,
                }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-center text-xs">{value}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="mb-2 block font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            TITLE
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Water pump not working"
            maxLength={200}
            className={`min-h-11 w-full rounded-lg px-3 text-sm ${TENANT_FOCUS_RING}`}
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            DESCRIPTION
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="No water pressure since Monday morning"
            className={`w-full rounded-lg px-3 py-2.5 text-sm ${TENANT_FOCUS_RING}`}
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            PHOTOS (UP TO {MAX_PHOTOS})
          </p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => {
              const pct = Math.round(p.progress * 100);
              return (
                <div
                  key={p.id}
                  className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg"
                  style={{ backgroundColor: t.cardBg, border: `1px solid ${p.status === "failed" ? "#f87171" : t.cardBorder}` }}
                >
                  {p.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL of the chosen photo, not a remote image
                    <img src={p.previewUrl} alt="" className={`h-full w-full object-cover ${p.status === "failed" ? "opacity-40" : ""}`} />
                  ) : (
                    <Bone className="h-full w-full rounded-none" />
                  )}

                  {p.status === "uploading" && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 pb-1 pt-0.5" role="status" aria-label={`Sending photo, ${pct}%`}>
                      <p className="text-center font-mono text-[10px] text-white">{pct}%</p>
                      <div className="h-1 overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full w-full origin-left rounded-full transition-transform duration-200 motion-reduce:transition-none"
                          style={{ backgroundColor: t.accentLight, transform: `scaleX(${p.progress})` }}
                        />
                      </div>
                    </div>
                  )}

                  {p.status === "failed" && p.retryable && (
                    <button
                      type="button"
                      onClick={() => retry(p.id)}
                      aria-label="Retry sending this photo"
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-white ${TENANT_FOCUS_RING}`}
                    >
                      <RotateCw className="h-5 w-5" aria-hidden="true" />
                      <span className="font-mono text-[10px]">RETRY</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    aria-label="Remove this photo"
                    className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white after:absolute after:-inset-2 after:content-[''] ${TENANT_FOCUS_RING}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`press flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg ${TENANT_FOCUS_RING}`}
                style={{ backgroundColor: t.cardBg, border: `1px dashed ${t.cardBorder}`, color: t.fgMuted }}
              >
                <Camera className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
          <p className="mt-2 text-xs" style={{ color: failed ? "#f87171" : t.fgFaint }} role={failed ? "alert" : undefined}>
            {failed?.error ?? "Photos are shrunk to about 300 KB before sending, so they go through on slow data."}
          </p>
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            DOES THE LANDLORD NEED ACCESS TO FIX THIS?
          </p>
          <div className="flex gap-3">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setAccessOk(opt.value)}
                aria-pressed={accessOk === opt.value}
                className={`press min-h-11 flex-1 rounded-lg text-sm font-medium ${TENANT_FOCUS_RING}`}
                style={{
                  backgroundColor: accessOk === opt.value ? t.accent : t.cardBg,
                  border: `1px solid ${accessOk === opt.value ? t.accent : t.cardBorder}`,
                  color: accessOk === opt.value ? "#fff" : t.fgMuted,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={createComplaint.isPending}
          className={`press min-h-12 w-full rounded-lg font-mono text-sm font-medium text-white disabled:opacity-50 ${TENANT_FOCUS_RING}`}
          style={{ backgroundColor: t.accent }}
        >
          {createComplaint.isPending ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
