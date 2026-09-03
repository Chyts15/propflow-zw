"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ImageIcon, Loader2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { TENANT_DARK } from "@/components/tenant/theme";

// EcoCash first, per CLAUDE.md § Zimbabwe Locale.
const METHODS = [
  { value: "ECOCASH", label: "EcoCash", dot: "#00A850" },
  { value: "ONEMONEY", label: "OneMoney", dot: "#E30613" },
  { value: "INNBUCKS", label: "InnBucks", dot: "#F7A800" },
  { value: "BANK_TRANSFER", label: "Bank", dot: "#3b82f6" },
  { value: "CASH_USD", label: "Cash", dot: "#4ade80" },
] as const;

export function PaymentProofUpload({
  rentRecordId,
  alreadySubmitted,
}: {
  rentRecordId: string;
  alreadySubmitted: boolean;
}) {
  const t = TENANT_DARK;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("ECOCASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [photo, setPhoto] = useState<{ url: string; uploading: boolean } | null>(null);

  const getUploadUrl = trpc.rent.getUploadUrl.useMutation();
  const submitProof = trpc.rent.submitProof.useMutation({
    onSuccess: () => {
      toast.success("Proof submitted — your landlord will review it.");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPEG or PNG screenshots are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be under 5MB");
      return;
    }

    setPhoto({ url: "", uploading: true });
    try {
      const { uploadUrl, publicUrl } = await getUploadUrl.mutateAsync({
        contentType: file.type as "image/jpeg" | "image/png",
        contentLength: file.size,
      });
      const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error("Upload failed");
      setPhoto({ url: publicUrl, uploading: false });
    } catch (err) {
      setPhoto(null);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "ECOCASH" && !/^EC\d{10}$/.test(referenceNo)) {
      return toast.error("EcoCash reference must be EC followed by 10 digits");
    }
    if (!photo || photo.uploading) return toast.error("Add a screenshot of your payment");

    submitProof.mutate({ rentRecordId, method, referenceNo: referenceNo || undefined, proofImageUrl: photo.url });
  }

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
      <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
        Upload payment proof
      </p>

      {alreadySubmitted && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: `${t.accent}26`, color: t.accentLight }}
        >
          <Check className="h-3.5 w-3.5 shrink-0" />
          Proof already submitted — awaiting your landlord&apos;s confirmation. You can resubmit below if needed.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            PAYMENT METHOD
          </p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: method === m.value ? `${m.dot}1a` : "transparent",
                  border: `1px solid ${method === m.value ? m.dot : t.cardBorder}`,
                  color: method === m.value ? t.fg : t.fgMuted,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.dot }} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="referenceNo" className="mb-2 block font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            REFERENCE NUMBER
          </label>
          <input
            id="referenceNo"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            placeholder={method === "ECOCASH" ? "EC0123456789" : "Optional"}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ backgroundColor: t.mainBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            SCREENSHOT
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg py-8"
            style={{ backgroundColor: t.mainBg, border: `1px dashed ${t.cardBorder}`, color: t.fgMuted }}
          >
            {photo?.uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Payment screenshot" className="h-24 rounded-lg object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6" />
            )}
            <span className="text-sm">{photo && !photo.uploading ? "Tap to replace" : "Tap to upload a screenshot (max 5MB)"}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />
        </div>

        <button
          type="submit"
          disabled={submitProof.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-3 font-mono text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: t.accentLight }}
        >
          <Check className="h-4 w-4" /> {submitProof.isPending ? "Submitting…" : "Submit proof"}
        </button>
      </form>
    </div>
  );
}
