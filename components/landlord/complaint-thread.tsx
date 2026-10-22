"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Clock, MessageSquareWarning, Phone, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_TONE,
  FOCUS_RING,
  LANDLORD_DARK,
  PRIORITY_LABEL,
  PRIORITY_TONE,
} from "@/components/landlord/theme";
import { ProofBadge } from "@/components/landlord/proof-lightbox";
import { isResolved } from "@/lib/complaint-queue";
import {
  PRIORITY_VALUES,
  REPLY_MAX,
  STATUS_VALUES,
  dayBreaks,
  formatClock,
  isSendable,
  mergeMessages,
  needsUndo,
  parsePriority,
  parseStatus,
  restoreDraft,
  shouldSendOnKey,
  slaLabel,
  slaStatus,
  telHref,
  type ComplaintPriorityValue,
  type ComplaintStatusValue,
  type ThreadMessage,
} from "@/lib/complaint-thread";
import { formatLongDate } from "@/lib/dates";
import { formatZwPhone } from "@/lib/phone";
import { friendlyMessage } from "@/lib/trpc-error";
import { idForAttempt, newMessageId, type UnconfirmedAttempt } from "@/lib/message-id";

const t = LANDLORD_DARK;
const BONE = "rgba(255,255,255,0.07)";
const OWN_BUBBLE = "#9a3a1a";
const NEUTRAL_TONE = { bg: "rgba(255,255,255,0.1)", fg: "rgba(255,255,255,0.7)" };

const STATUS_OPTIONS = STATUS_VALUES.map((value) => ({ value, label: COMPLAINT_STATUS_LABEL[value] }));
const PRIORITY_OPTIONS = PRIORITY_VALUES.map((value) => ({ value, label: PRIORITY_LABEL[value] }));

type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
  resolvedAt: Date | null;
  imageUrls: string[];
  unit: { unitNumber: string; property: { name: string } };
  tenantName: string;
  tenantPhone: string | null;
  messages: ThreadMessage[];
};

/** A reply sent from this screen. It shows at once and is swapped for the saved one when the server answers. */
type LocalMessage = ThreadMessage & { key: string; sending: boolean };

type Retry =
  | { type: "reply" }
  | { type: "status"; next: ComplaintStatusValue }
  | { type: "priority"; next: ComplaintPriorityValue };

type Notice =
  | { kind: "undo"; previous: string }
  | { kind: "error"; message: string; retry?: Retry; billing?: boolean };

function failure(
  err: { message: string; data?: { code?: string } | null },
  fallback: string,
  retry: Retry,
): Notice {
  const code = err.data?.code;
  // A forbidden or missing complaint will not be fixed by trying again.
  const final = code === "FORBIDDEN" || code === "NOT_FOUND";
  return { kind: "error", message: friendlyMessage(err, fallback), retry: final ? undefined : retry, billing: code === "FORBIDDEN" };
}

/** The shape of the thread while it loads: same header, bubbles and composer heights. */
export function ComplaintThreadSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex h-full min-h-0 flex-col">
      <span className="sr-only">Loading complaint…</span>
      <div className="shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pt-4" style={{ backgroundColor: t.sidebarBg }}>
        <div className="flex h-11 items-center gap-3">
          <div aria-hidden="true" className="h-9 w-9 rounded-full sm:hidden motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
          <div className="flex-1">
            <div aria-hidden="true" className="h-5 w-40 rounded-md motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
            <div aria-hidden="true" className="mt-1.5 h-3 w-48 rounded-md motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
          {[0, 1].map((i) => (
            <div key={i}>
              <div aria-hidden="true" className="mb-1 h-3 w-14 rounded-md motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
              <div aria-hidden="true" className="h-11 rounded-2xl motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 h-6 w-44 rounded-md motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-3 py-4 sm:px-5">
        <div aria-hidden="true" className="h-28 w-4/5 rounded-2xl motion-safe:animate-pulse sm:w-96" style={{ backgroundColor: t.cardBg }} />
        <div aria-hidden="true" className="ml-auto h-16 w-3/5 rounded-2xl motion-safe:animate-pulse sm:w-72" style={{ backgroundColor: BONE }} />
        <div aria-hidden="true" className="h-14 w-2/3 rounded-2xl motion-safe:animate-pulse sm:w-80" style={{ backgroundColor: t.cardBg }} />
      </div>
      <div className="flex shrink-0 items-end gap-2 px-3 py-3 sm:px-5" style={{ backgroundColor: t.sidebarBg }}>
        <div aria-hidden="true" className="h-11 flex-1 rounded-2xl motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
        <div aria-hidden="true" className="h-11 w-11 rounded-2xl motion-safe:animate-pulse" style={{ backgroundColor: BONE }} />
      </div>
    </div>
  );
}

function ToneSelect<V extends string>({
  id,
  label,
  value,
  tone,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  tone: { bg: string; fg: string };
  options: { value: V; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-wide" style={{ color: t.fgMuted }}>
        {label}
      </label>
      {/* A native select: on a phone it opens the system picker, which is a full-size sheet within
          thumb reach, costs no JavaScript, and works with the screen reader as is. The word shows
          in the control, the tint only backs it up. */}
      <div className="relative rounded-2xl" style={{ backgroundColor: tone.bg }}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`min-h-11 w-full cursor-pointer appearance-none rounded-2xl bg-transparent py-2 pl-3 pr-9 font-mono text-xs uppercase ${FOCUS_RING}`}
          style={{ color: tone.fg, colorScheme: "dark" }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1f130d] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: tone.fg }} />
      </div>
    </div>
  );
}

function Bubble({ mine, className = "", children }: { mine: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${className}`}>
      <div
        className={`max-w-[85%] rounded-2xl p-3 sm:max-w-md ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}
        style={
          mine
            ? { backgroundColor: OWN_BUBBLE, color: "#fff" }
            : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }
        }
      >
        {children}
      </div>
    </div>
  );
}

function DayBreak({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <p className="pt-1 text-center font-mono text-[11px] tracking-wide" style={{ color: t.fgMuted }}>
      {label}
    </p>
  );
}

export function ComplaintThread({ complaint, viewerName }: { complaint: Complaint; viewerName: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const listRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  // The id of a reply whose send has not been confirmed. Sending the same words again reuses it, so
  // a lost response followed by Try again is saved once; different words, or a confirmed send, start a new id.
  const unconfirmed = useRef<UnconfirmedAttempt | null>(null);

  const [draft, setDraft] = useState("");
  const [local, setLocal] = useState<LocalMessage[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Status and priority show the tap at once. The override is thrown away if the server refuses
  // the change, and when fresh props arrive (they then carry the truth).
  const [override, setOverride] = useState<{ status?: string; priority?: string }>({});
  const [seen, setSeen] = useState({ status: complaint.status, priority: complaint.priority });
  const [flash, setFlash] = useState(0);

  if (seen.status !== complaint.status || seen.priority !== complaint.priority) {
    setSeen({ status: complaint.status, priority: complaint.priority });
    setOverride({});
  }

  const status = override.status ?? complaint.status;
  const priority = override.priority ?? complaint.priority;
  const done = isResolved(status);
  const sla = slaStatus(complaint.createdAt, priority, done, new Date());
  const phoneHref = telHref(complaint.tenantPhone);
  const phoneText = complaint.tenantPhone ? formatZwPhone(complaint.tenantPhone) : null;
  const firstName = complaint.tenantName.split(" ")[0];

  const updateStatus = trpc.complaints.updateStatus.useMutation();
  const updatePriority = trpc.complaints.updatePriority.useMutation();
  const sendReply = trpc.complaints.reply.useMutation();

  const messages = mergeMessages(complaint.messages, local);
  const breaks = dayBreaks([complaint.createdAt, ...messages.map((m) => m.createdAt)]);

  // Newest at the bottom, in view, as in any chat.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // An undo is on offer for a few seconds, then the status is simply settled.
  useEffect(() => {
    if (notice?.kind !== "undo") return;
    const timer = window.setTimeout(() => setNotice((n) => (n === notice ? null : n)), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function changeStatus(next: ComplaintStatusValue, isUndo = false) {
    if (updateStatus.isPending || next === status) return;
    const previous = status;
    setOverride((o) => ({ ...o, status: next }));
    setNotice(!isUndo && needsUndo(next) ? { kind: "undo", previous } : null);
    updateStatus.mutate(
      { complaintId: complaint.id, status: next },
      {
        onSuccess: () => {
          setFlash((n) => n + 1);
          // The queue's lists and the open-complaints count in the shell both depend on this.
          void utils.complaints.list.invalidate();
          router.refresh();
        },
        onError: (err) => {
          setOverride((o) => ({ ...o, status: undefined }));
          setNotice(failure(err, "Couldn't change the status.", { type: "status", next }));
        },
      },
    );
  }

  function changePriority(next: ComplaintPriorityValue) {
    if (updatePriority.isPending || next === priority) return;
    setOverride((o) => ({ ...o, priority: next }));
    setNotice(null);
    updatePriority.mutate(
      { complaintId: complaint.id, priority: next },
      {
        onSuccess: () => {
          setFlash((n) => n + 1);
          void utils.complaints.list.invalidate();
          router.refresh();
        },
        onError: (err) => {
          setOverride((o) => ({ ...o, priority: undefined }));
          setNotice(failure(err, "Couldn't change the priority.", { type: "priority", next }));
        },
      },
    );
  }

  function send() {
    const body = draft.trim();
    if (!isSendable(body) || sendReply.isPending) return;
    const key = idForAttempt(unconfirmed.current, body, newMessageId);
    unconfirmed.current = { id: key, content: body };
    setLocal((l) => [
      ...l,
      { id: key, key, senderRole: "LANDLORD", senderName: viewerName, body, imageUrls: [], createdAt: new Date(), sending: true },
    ]);
    setDraft("");
    setNotice(null);
    boxRef.current?.focus();
    sendReply.mutate(
      { complaintId: complaint.id, messageId: key, body, imageUrls: [] },
      {
        onSuccess: (saved) => {
          if (unconfirmed.current?.id === key) unconfirmed.current = null;
          setLocal((l) => l.map((m) => (m.key === key ? { ...m, id: saved.id, createdAt: saved.createdAt, sending: false } : m)));
        },
        onError: (err) => {
          // Roll back: the bubble goes and the words go back in the box.
          setLocal((l) => l.filter((m) => m.key !== key));
          setDraft((current) => restoreDraft(current, body));
          setNotice(failure(err, "Couldn't send your reply.", { type: "reply" }));
        },
      },
    );
  }

  function retry(n: Extract<Notice, { kind: "error" }>) {
    setNotice(null);
    if (n.retry?.type === "reply") send();
    else if (n.retry?.type === "status") changeStatus(n.retry.next);
    else if (n.retry?.type === "priority") changePriority(n.retry.next);
  }

  function undo(previous: string) {
    const prior = parseStatus(previous);
    if (prior) changeStatus(prior, true);
    else setNotice(null);
  }

  const statusTone = COMPLAINT_STATUS_TONE[status] ?? NEUTRAL_TONE;
  const priorityTone = PRIORITY_TONE[priority] ?? NEUTRAL_TONE;
  const canSend = isSendable(draft);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ backgroundColor: t.mainBg }}>
      <header className="shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pt-4" style={{ backgroundColor: t.sidebarBg }}>
        <div className="flex items-center gap-1">
          <Link
            href="/complaints"
            aria-label="Back to all complaints"
            className={`press -ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:hidden ${FOCUS_RING}`}
            style={{ color: t.fg }}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading truncate text-base font-extrabold sm:text-lg" style={{ color: t.fg }}>
              {complaint.tenantName}
            </h1>
            <p className="truncate text-xs" style={{ color: t.fgMuted }}>
              Unit {complaint.unit.unitNumber} · {complaint.unit.property.name}
            </p>
          </div>
          {phoneHref && (
            <a
              href={phoneHref}
              aria-label={`Call ${complaint.tenantName}${phoneText ? ` on ${phoneText}` : ""}`}
              className={`press flex h-11 shrink-0 items-center justify-center gap-2 rounded-full font-mono text-xs sm:px-4 w-11 sm:w-auto ${FOCUS_RING}`}
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.accentLight }}
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">{phoneText}</span>
            </a>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
          <ToneSelect
            id="complaint-status"
            label="Status"
            value={status}
            tone={statusTone}
            options={STATUS_OPTIONS}
            onChange={(v) => {
              const next = parseStatus(v);
              if (next) changeStatus(next);
            }}
          />
          <ToneSelect
            id="complaint-priority"
            label="Priority"
            value={priority}
            tone={priorityTone}
            options={PRIORITY_OPTIONS}
            onChange={(v) => {
              const next = parsePriority(v);
              if (next) changePriority(next);
            }}
          />
        </div>

        {/* This line keeps its height whichever state it is in, so a status change moves nothing. */}
        <p
          key={flash}
          suppressHydrationWarning
          className={`mt-2 flex min-h-6 items-center gap-1.5 rounded-lg font-mono text-[11px] tracking-wide ${flash ? "row-flash" : ""}`}
          style={{ color: sla?.overdue ? "#f87171" : t.fgMuted }}
        >
          <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {sla
            ? slaLabel(sla)
            : `${COMPLAINT_STATUS_LABEL[status] ?? "Resolved"} ${complaint.resolvedAt ? formatLongDate(complaint.resolvedAt) : "just now"}`}
        </p>
      </header>

      <div ref={listRef} role="log" aria-label="Conversation" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        <DayBreak label={breaks[0]} />
        <Bubble mine={false}>
          <p className="text-sm font-semibold">{complaint.title}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{complaint.description}</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wide" style={{ color: t.fgMuted }}>
            {complaint.category}
          </p>
          {complaint.imageUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {complaint.imageUrls.map((url, i) => (
                <ProofBadge
                  key={url}
                  proofImageUrl={url}
                  label={`Photo ${i + 1}`}
                  dialogTitle="Complaint photo"
                  size="comfortable"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }}
                />
              ))}
            </div>
          )}
          <p className="mt-2 font-mono text-[11px]" style={{ color: t.fgMuted }}>
            {complaint.tenantName} · <time dateTime={complaint.createdAt.toISOString()}>{formatClock(complaint.createdAt)}</time>
          </p>
        </Bubble>

        {messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm" style={{ color: t.fgMuted }}>
            <MessageSquareWarning aria-hidden="true" className="h-4 w-4" /> No replies yet
          </div>
        )}

        {messages.map((m, i) => {
          const mine = m.senderRole === "LANDLORD";
          const pending = "sending" in m;
          return (
            <div key={pending ? m.key : m.id} className="space-y-3">
              <DayBreak label={breaks[i + 1]} />
              <Bubble mine={mine} className={pending ? "page-enter" : ""}>
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                <p className="mt-1.5 font-mono text-[11px]" style={{ color: mine ? "rgba(255,255,255,0.8)" : t.fgMuted }}>
                  {m.senderName} ·{" "}
                  {pending && m.sending ? "Sending…" : <time dateTime={m.createdAt.toISOString()}>{formatClock(m.createdAt)}</time>}
                </p>
              </Bubble>
            </div>
          );
        })}
      </div>

      <div className="shrink-0" style={{ backgroundColor: t.sidebarBg }}>
        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className="page-enter mx-3 mt-3 flex min-h-11 items-center gap-1 rounded-2xl py-1 pl-3.5 pr-1 text-sm sm:mx-5"
            style={
              notice.kind === "error"
                ? { backgroundColor: "rgba(248,113,113,0.15)", color: "#fca5a5" }
                : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }
            }
          >
            <span className="min-w-0 flex-1">
              {notice.kind === "error" ? notice.message : `Marked as ${(COMPLAINT_STATUS_LABEL[status] ?? "done").toLowerCase()}.`}
            </span>
            {notice.kind === "undo" && (
              <button
                type="button"
                onClick={() => undo(notice.previous)}
                aria-disabled={updateStatus.isPending || undefined}
                className={`press min-h-11 shrink-0 rounded-xl px-3 font-mono text-xs aria-disabled:opacity-60 ${FOCUS_RING}`}
                style={{ color: t.accentLight }}
              >
                UNDO
              </button>
            )}
            {notice.kind === "error" && notice.retry && (
              <button
                type="button"
                onClick={() => retry(notice)}
                className={`press min-h-11 shrink-0 rounded-xl px-3 font-mono text-xs text-white ${FOCUS_RING}`}
              >
                TRY AGAIN
              </button>
            )}
            {notice.kind === "error" && notice.billing && (
              <Link href="/settings/billing" className={`press flex min-h-11 shrink-0 items-center rounded-xl px-3 font-mono text-xs text-white ${FOCUS_RING}`}>
                BILLING
              </Link>
            )}
            {notice.kind === "error" && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setNotice(null)}
                className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${FOCUS_RING}`}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 px-3 py-3 sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="complaint-reply" className="sr-only">
              Reply to {complaint.tenantName}
            </label>
            {/* field-sizing grows the box with the text (up to about five lines) where the browser
                supports it; elsewhere it stays one line and scrolls. */}
            <textarea
              id="complaint-reply"
              ref={boxRef}
              rows={1}
              value={draft}
              maxLength={REPLY_MAX}
              enterKeyHint="send"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (shouldSendOnKey({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing })) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Reply to ${firstName}…`}
              className={`field-sizing-content block max-h-32 min-h-11 w-full resize-none rounded-2xl px-3.5 py-2.5 text-sm placeholder:text-white/55 ${FOCUS_RING}`}
              style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
            />
            {draft.length > REPLY_MAX - 200 && (
              <p className="mt-1 text-right font-mono text-[11px]" style={{ color: t.fgMuted }}>
                {REPLY_MAX - draft.length} characters left
              </p>
            )}
          </div>
          <button
            type="submit"
            aria-label="Send reply"
            aria-disabled={!canSend || undefined}
            className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white aria-disabled:opacity-40 ${FOCUS_RING}`}
            style={{ backgroundColor: t.accent }}
          >
            <Send aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
