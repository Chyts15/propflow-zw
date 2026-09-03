"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Clock, Send, MessageSquareWarning } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { LANDLORD_DARK, PRIORITY_GLOW } from "@/components/landlord/theme";
import { ProofBadge } from "@/components/landlord/proof-lightbox";

const STATUSES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SLA_HOURS: Record<string, number> = { CRITICAL: 24, HIGH: 48, MEDIUM: 72, LOW: 168 };

function slaLabel(createdAt: Date, priority: string, resolved: boolean) {
  if (resolved) return null;
  const hours = SLA_HOURS[priority] ?? 72;
  const deadline = new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
  const remainingMs = deadline.getTime() - Date.now();
  const overdue = remainingMs < 0;
  const absHours = Math.abs(Math.round(remainingMs / (60 * 60 * 1000)));
  const text = absHours < 24 ? `${absHours}h` : `${Math.round(absHours / 24)}d`;
  return { overdue, text };
}

type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: Date;
  imageUrls: string[];
  unit: { unitNumber: string };
  tenantName: string;
  tenantPhone: string | null;
  messages: { id: string; senderRole: string; senderName: string; body: string; imageUrls: string[]; createdAt: Date }[];
};

export function ComplaintThread({ complaint }: { complaint: Complaint }) {
  const t = LANDLORD_DARK;
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [notifySms, setNotifySms] = useState(true);

  const updateStatus = trpc.complaints.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const updatePriority = trpc.complaints.updatePriority.useMutation({
    onSuccess: () => router.refresh(),
    onError: (err) => toast.error(err.message),
  });
  const sendReply = trpc.complaints.reply.useMutation({
    onSuccess: () => {
      setReply("");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const resolved = complaint.status === "RESOLVED" || complaint.status === "CLOSED";
  const sla = slaLabel(complaint.createdAt, complaint.priority, resolved);

  return (
    <div className="flex h-full min-h-screen flex-col">
      <div className="p-5" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-extrabold" style={{ color: t.fg }}>
              Unit {complaint.unit.unitNumber} · {complaint.tenantName}
            </p>
            <p className="text-sm" style={{ color: t.fgMuted }}>
              {complaint.title} · {complaint.category}
            </p>
          </div>
          {sla && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px]"
              style={sla.overdue ? { backgroundColor: "rgba(220,38,38,0.15)", color: "#f87171" } : { backgroundColor: t.cardBg, color: t.fgMuted, border: `1px solid ${t.cardBorder}` }}
            >
              <Clock className="h-3 w-3" />
              {sla.overdue ? `Overdue ${sla.text}` : `${sla.text} left`}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateStatus.mutate({ complaintId: complaint.id, status: s })}
                disabled={updateStatus.isPending}
                className="rounded-full px-2.5 py-1 font-mono text-[11px]"
                style={
                  complaint.status === s
                    ? { backgroundColor: t.accent, color: "#fff" }
                    : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }
                }
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: t.fgFaint }}>
            ·
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updatePriority.mutate({ complaintId: complaint.id, priority: p })}
                disabled={updatePriority.isPending}
                className="rounded-full px-2.5 py-1 font-mono text-[11px]"
                style={
                  complaint.priority === p
                    ? { backgroundColor: PRIORITY_GLOW[p], color: "#fff" }
                    : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fgMuted }
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex justify-start">
          <div className="max-w-md rounded-2xl rounded-bl-sm p-3" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <p className="text-sm" style={{ color: t.fg }}>
              {complaint.description}
            </p>
            {complaint.imageUrls.length > 0 && (
              <div className="mt-2 flex gap-2">
                {complaint.imageUrls.map((url, i) => (
                  <ProofBadge
                    key={url}
                    proofImageUrl={url}
                    label={`Photo ${i + 1}`}
                    dialogTitle="Complaint photo"
                    style={{ backgroundColor: "rgba(255,255,255,0.08)", color: t.fgMuted }}
                  />
                ))}
              </div>
            )}
            <p className="mt-1 text-[10px]" style={{ color: t.fgFaint }}>
              {complaint.tenantName}
            </p>
          </div>
        </div>

        {complaint.messages.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm" style={{ color: t.fgFaint }}>
            <MessageSquareWarning className="h-4 w-4" /> No replies yet
          </div>
        )}

        {complaint.messages.map((m) => {
          const isLandlord = m.senderRole === "LANDLORD";
          return (
            <div key={m.id} className={`flex ${isLandlord ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-md rounded-2xl p-3 ${isLandlord ? "rounded-br-sm" : "rounded-bl-sm"}`}
                style={
                  isLandlord
                    ? { backgroundColor: "#9A3A1A", color: "#fff" }
                    : { backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }
                }
              >
                <p className="text-sm">{m.body}</p>
                <p className="mt-1 text-[10px] opacity-60">{m.senderName}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
        <div className="flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to tenant…"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.fg }}
          />
          <button
            type="button"
            disabled={!reply.trim() || sendReply.isPending}
            onClick={() => sendReply.mutate({ complaintId: complaint.id, body: reply })}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-40"
            style={{ backgroundColor: t.accent }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: t.fgMuted }}>
          <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} disabled title="SMS — Step 7" />
          Also notify via SMS
        </label>
      </div>
    </div>
  );
}
