"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertCircle, Check, CheckCircle2, ImageIcon, RotateCw } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { tenantErrorMessage } from "@/lib/tenant-errors";
import { formatKb, rejectSource } from "@/lib/image-upload";
import {
  MAX_REFERENCE_LENGTH,
  normalizeReference,
  parseProofDraft,
  proofDraftKey,
  referenceProblem,
  serializeProofDraft,
  type ProofMethod,
} from "@/lib/payment-reference";
import { PAYMENT_METHOD_LABEL } from "@/lib/tenant-rent-view";
import { Bone } from "@/components/tenant/skeletons";
import { TENANT_DARK, TENANT_FOCUS_RING } from "@/components/tenant/theme";
import { useImageUploads } from "@/components/tenant/use-image-uploads";

// EcoCash first, per CLAUDE.md § Zimbabwe Locale.
const METHODS: readonly { value: ProofMethod; label: string; dot: string }[] = [
  { value: "ECOCASH", label: "EcoCash", dot: "#00A850" },
  { value: "ONEMONEY", label: "OneMoney", dot: "#E30613" },
  { value: "INNBUCKS", label: "InnBucks", dot: "#F7A800" },
  { value: "BANK_TRANSFER", label: "Bank", dot: "#3b82f6" },
  { value: "CASH_USD", label: "Cash", dot: "#4ade80" },
];

const DANGER = "#f87171";

function readDraft(rentRecordId: string) {
  try {
    return parseProofDraft(sessionStorage.getItem(proofDraftKey(rentRecordId)));
  } catch {
    return null; // storage blocked (private mode, restricted webview): the form simply starts empty
  }
}

function writeDraft(rentRecordId: string, draft: { method: ProofMethod; referenceNo: string } | null) {
  try {
    if (draft) sessionStorage.setItem(proofDraftKey(rentRecordId), serializeProofDraft(draft));
    else sessionStorage.removeItem(proofDraftKey(rentRecordId));
  } catch {
    // Same: a draft is a convenience, never a requirement.
  }
}

export function PaymentProofUpload({
  rentRecordId,
  alreadySubmitted,
}: {
  rentRecordId: string;
  /** The server already holds a proof for this record (RentRecord.proofImageUrl). */
  alreadySubmitted: boolean;
}) {
  const t = TENANT_DARK;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);

  const [method, setMethod] = useState<ProofMethod>("ECOCASH");
  const [referenceNo, setReferenceNo] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ method: string; referenceNo: string } | null>(null);
  const [reopened, setReopened] = useState(false);

  const getUploadUrl = trpc.rent.getUploadUrl.useMutation();
  const { items, add, retry, remove } = useImageUploads({
    requestUploadUrl: (input) => getUploadUrl.mutateAsync(input),
    max: 1,
  });
  const photo = items[0];

  // Restore what the tenant already typed if the page was reloaded or the connection dropped. It is
  // read after mount so the server-rendered form and the first client render always match.
  useEffect(() => {
    const draft = readDraft(rentRecordId);
    /* eslint-disable react-hooks/set-state-in-effect -- syncing from browser-only storage after hydration, so the server and first client render still match */
    if (draft) {
      setMethod(draft.method);
      setReferenceNo(draft.referenceNo);
    }
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [rentRecordId]);

  useEffect(() => {
    if (draftReady) writeDraft(rentRecordId, { method, referenceNo });
  }, [draftReady, rentRecordId, method, referenceNo]);

  const submitProof = trpc.rent.submitProof.useMutation({
    onSuccess: (_record, vars) => {
      writeDraft(rentRecordId, null);
      setSent({ method: vars.method, referenceNo: vars.referenceNo ?? "" });
      setReopened(false);
      setSubmitError(null);
      router.refresh();
    },
    onError: (err) => {
      const message = tenantErrorMessage(err);
      setSubmitError(message);
      toast.error(message);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!file) return;
    const problem = rejectSource(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhotoError(null);
    setSubmitError(null);
    add(file);
  }

  function chooseMethod(next: ProofMethod) {
    setMethod(next);
    setReferenceNo((current) => normalizeReference(current, next));
    setReferenceError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const reference = normalizeReference(referenceNo, method);
    setReferenceNo(reference);

    const problem = referenceProblem(reference, method);
    if (problem) {
      setReferenceError(problem);
      referenceRef.current?.focus();
      return;
    }
    if (!photo) {
      setPhotoError("Add a screenshot of your payment first.");
      return;
    }
    if (photo.status !== "done" || !photo.publicUrl) {
      setPhotoError(photo.status === "failed" ? "Your photo hasn't been sent yet. Tap Retry first." : "Wait for your photo to finish sending.");
      return;
    }

    setReferenceError(null);
    setPhotoError(null);
    setSubmitError(null);
    submitProof.mutate({ rentRecordId, method, referenceNo: reference || undefined, proofImageUrl: photo.publicUrl });
  }

  function startAgain() {
    if (photo) remove(photo.id);
    setSent(null);
    setReopened(true);
    setMethod("ECOCASH");
    setReferenceNo("");
    setPhotoError(null);
    setSubmitError(null);
  }

  const card = { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const busy = photo?.status === "preparing" || photo?.status === "uploading";

  // Persistent confirmation right after sending (the page behind it refreshes to the same truth).
  if (sent) {
    return (
      <div role="status" className="rounded-2xl p-5" style={card}>
        <p className="flex items-center gap-2 font-heading text-lg font-extrabold" style={{ color: t.accentLight }}>
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> Proof sent
        </p>
        <p className="mt-2 text-sm" style={{ color: t.fg }}>
          Your landlord will check it and confirm your payment. You don&apos;t need to send it again.
        </p>
        <p className="mt-1 font-mono text-xs" style={{ color: t.fgMuted }}>
          {PAYMENT_METHOD_LABEL[sent.method] ?? "Other"}
          {sent.referenceNo ? ` · ${sent.referenceNo}` : ""}
        </p>
        <button
          type="button"
          onClick={startAgain}
          className={`press mt-4 min-h-11 rounded-lg px-5 font-mono text-xs font-medium ${TENANT_FOCUS_RING}`}
          style={{ border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
        >
          SEND A DIFFERENT PROOF
        </button>
      </div>
    );
  }

  // A proof is already on file (the rent card above says so); the form stays out of the way.
  if (alreadySubmitted && !reopened) {
    return (
      <div className="rounded-2xl p-5" style={card}>
        <p className="text-sm" style={{ color: t.fgMuted }}>
          Sent the wrong screenshot, or paid more since? You can send a new proof.
        </p>
        <button
          type="button"
          onClick={() => setReopened(true)}
          className={`press mt-3 min-h-11 rounded-lg px-5 font-mono text-xs font-medium ${TENANT_FOCUS_RING}`}
          style={{ border: `1px solid ${t.cardBorder}`, color: t.fg }}
        >
          SEND A NEW PROOF
        </button>
      </div>
    );
  }

  const submitLabel = submitProof.isPending
    ? "Submitting…"
    : photo?.status === "preparing"
      ? "Preparing your photo…"
      : photo?.status === "uploading"
        ? `Sending photo… ${Math.round(photo.progress * 100)}%`
        : "Submit proof";

  return (
    <div className="rounded-2xl p-5" style={card}>
      <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
        Upload payment proof
      </p>
      <p className="mt-1 text-sm" style={{ color: t.fgMuted }}>
        Pay your landlord as usual (EcoCash, bank or cash), then send a screenshot of the payment here.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-5">
        <div>
          <p id="method-label" className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            PAYMENT METHOD
          </p>
          <div role="radiogroup" aria-labelledby="method-label" className="flex flex-wrap gap-2">
            {METHODS.map((m) => {
              const selected = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseMethod(m.value)}
                  className={`press flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ${TENANT_FOCUS_RING}`}
                  style={{
                    backgroundColor: selected ? `${m.dot}1a` : "transparent",
                    border: `1px solid ${selected ? m.dot : t.cardBorder}`,
                    color: selected ? t.fg : t.fgMuted,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.dot }} aria-hidden="true" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="referenceNo" className="mb-2 block font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            REFERENCE NUMBER{method === "ECOCASH" ? "" : " (OPTIONAL)"}
          </label>
          <input
            ref={referenceRef}
            id="referenceNo"
            value={referenceNo}
            onChange={(e) => {
              setReferenceNo(e.target.value);
              setReferenceError(null);
            }}
            onBlur={() => setReferenceNo((current) => normalizeReference(current, method))}
            placeholder={method === "ECOCASH" ? "EC2406123456" : "Optional"}
            maxLength={MAX_REFERENCE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={referenceError ? true : undefined}
            aria-describedby="reference-hint"
            className={`min-h-11 w-full rounded-lg px-4 font-mono text-sm uppercase ${TENANT_FOCUS_RING}`}
            style={{ backgroundColor: t.mainBg, border: `1px solid ${referenceError ? DANGER : t.cardBorder}`, color: t.fg }}
          />
          <p id="reference-hint" role={referenceError ? "alert" : undefined} className="mt-1.5 text-xs" style={{ color: referenceError ? DANGER : t.fgMuted }}>
            {referenceError ?? (method === "ECOCASH" ? "From your EcoCash confirmation message: EC followed by 10 digits." : "The reference on your receipt or bank slip, if it has one.")}
          </p>
        </div>

        <div>
          <p className="mb-2 font-mono text-xs tracking-wide" style={{ color: t.fgMuted }}>
            SCREENSHOT
          </p>

          {!photo ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`press flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg px-4 py-5 ${TENANT_FOCUS_RING}`}
              style={{ backgroundColor: t.mainBg, border: `1px dashed ${t.cardBorder}`, color: t.fgMuted }}
            >
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm">Tap to add a screenshot</span>
              <span className="text-xs" style={{ color: t.fgFaint }}>
                We shrink it to about 300 KB so it sends on slow data.
              </span>
            </button>
          ) : (
            <div className="rounded-2xl p-3" style={{ backgroundColor: t.mainBg, border: `1px solid ${photo.status === "failed" ? DANGER : t.cardBorder}` }}>
              <div className="flex gap-3">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.07)" }}>
                  {photo.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL of the chosen photo, not a remote image
                    <img src={photo.previewUrl} alt="The screenshot you chose" className="h-full w-full object-cover" />
                  ) : (
                    <Bone className="h-full w-full rounded-none" />
                  )}
                </div>

                <div className="min-w-0 flex-1" aria-live="polite">
                  {photo.status === "preparing" && (
                    <>
                      <p className="text-sm font-medium" style={{ color: t.fg }}>
                        Preparing your photo…
                      </p>
                      <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                        Making it small enough to send quickly.
                      </p>
                      <Bone className="mt-3 h-2 w-full rounded-full" />
                    </>
                  )}

                  {photo.status === "uploading" && (
                    <>
                      <p className="text-sm font-medium" style={{ color: t.fg }}>
                        Sending… {Math.round(photo.progress * 100)}%
                      </p>
                      <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                        {photo.sizeBytes ? `${formatKb(photo.sizeBytes)}. ` : ""}Keep this page open.
                      </p>
                      <div
                        role="progressbar"
                        aria-label="Photo upload"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(photo.progress * 100)}
                        className="mt-3 h-2 overflow-hidden rounded-full"
                        style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                      >
                        <div
                          className="h-full w-full origin-left rounded-full transition-transform duration-200 motion-reduce:transition-none"
                          style={{ backgroundColor: t.accentLight, transform: `scaleX(${photo.progress})` }}
                        />
                      </div>
                    </>
                  )}

                  {photo.status === "done" && (
                    <>
                      <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: t.accentLight }}>
                        <Check className="h-4 w-4" aria-hidden="true" /> Photo ready
                      </p>
                      <p className="mt-1 text-xs" style={{ color: t.fgMuted }}>
                        {photo.sizeBytes ? `${formatKb(photo.sizeBytes)}. Uploaded and ready to submit.` : "Uploaded and ready to submit."}
                      </p>
                    </>
                  )}

                  {photo.status === "failed" && (
                    <p role="alert" className="flex items-start gap-1.5 text-sm" style={{ color: DANGER }}>
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{photo.error}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {photo.status === "failed" && photo.retryable && (
                      <button
                        type="button"
                        onClick={() => retry(photo.id)}
                        className={`press flex min-h-11 items-center gap-2 rounded-lg px-4 font-mono text-xs font-medium ${TENANT_FOCUS_RING}`}
                        style={{ backgroundColor: t.accentLight, color: "#04140f" }}
                      >
                        <RotateCw className="h-4 w-4" aria-hidden="true" /> RETRY
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => (busy ? remove(photo.id) : fileInputRef.current?.click())}
                      className={`press min-h-11 rounded-lg px-4 font-mono text-xs font-medium ${TENANT_FOCUS_RING}`}
                      style={{ border: `1px solid ${t.cardBorder}`, color: t.fgMuted }}
                    >
                      {busy ? "CANCEL" : "CHOOSE ANOTHER"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {photoError && (
            <p role="alert" className="mt-1.5 text-xs" style={{ color: DANGER }}>
              {photoError}
            </p>
          )}
        </div>

        {submitError && (
          <p role="alert" className="flex items-start gap-2 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "rgba(248,113,113,0.12)", color: DANGER }}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{submitError} Your details are still here. Tap Submit proof to try again.</span>
          </p>
        )}

        <button
          type="submit"
          disabled={submitProof.isPending || busy}
          className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-5 font-mono text-sm font-medium disabled:opacity-60 ${TENANT_FOCUS_RING}`}
          style={{ backgroundColor: t.accentLight, color: "#04140f" }}
        >
          {!submitProof.isPending && !busy && <Check className="h-4 w-4" aria-hidden="true" />}
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
