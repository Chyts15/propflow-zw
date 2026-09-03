"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Wrench, Zap, Droplets, Shield, Building2, MoreHorizontal, Camera, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { TENANT_DARK } from "@/components/tenant/theme";

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

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessOk, setAccessOk] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<{ url: string; uploading: boolean }[]>([]);

  const getUploadUrl = trpc.complaints.getUploadUrl.useMutation();
  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: () => {
      toast.success("Complaint submitted — we'll SMS you when it's updated.");
      router.push("/my-complaints");
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || photos.length >= MAX_PHOTOS) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG or PNG photos are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }

    const placeholder = { url: "", uploading: true };
    setPhotos((p) => [...p, placeholder]);
    const index = photos.length;

    try {
      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
        contentType: file.type as "image/jpeg" | "image/png",
        contentLength: file.size,
      });
      const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error("Upload failed");
      setPhotos((p) => p.map((ph, i) => (i === index ? { url: publicUrl, uploading: false } : ph)));
    } catch (err) {
      setPhotos((p) => p.filter((_, i) => i !== index));
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function removePhoto(index: number) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return toast.error("Choose a category");
    if (!title.trim()) return toast.error("Add a short title");
    if (!description.trim()) return toast.error("Describe the issue");
    if (accessOk === null) return toast.error("Let us know if the landlord needs access");
    if (photos.some((p) => p.uploading)) return toast.error("Wait for photos to finish uploading");

    createComplaint.mutate({
      category,
      title,
      description: `${description}${accessOk ? "" : "\n\n(Tenant declined access permission.)"}`,
      imageUrls: photos.map((p) => p.url),
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-extrabold sm:text-3xl" style={{ color: t.fg }}>
        Report an Issue
      </h1>
      <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
        We&apos;ll SMS you when your complaint is updated.
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
                className="flex flex-col items-center gap-2 rounded-2xl p-4"
                style={{
                  backgroundColor: t.cardBg,
                  border: `1.5px solid ${category === value ? t.accent : t.cardBorder}`,
                  color: category === value ? t.accentLight : t.fgMuted,
                }}
              >
                <Icon className="h-5 w-5" />
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
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
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
            placeholder="No water pressure since Monday morning"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            PHOTOS (UP TO {MAX_PHOTOS})
          </p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div
                key={i}
                className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg"
                style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}
              >
                {p.uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: t.fgMuted }} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg"
                style={{ backgroundColor: t.cardBg, border: `1px dashed ${t.cardBorder}`, color: t.fgMuted }}
              >
                <Camera className="h-5 w-5" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />
          </div>
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
                className="flex-1 rounded-lg py-2.5 text-sm font-medium"
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
          className="w-full rounded-lg py-3 font-mono text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: t.accent }}
        >
          {createComplaint.isPending ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}
