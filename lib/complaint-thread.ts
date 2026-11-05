// The rules behind a complaint thread on the landlord side: the service clock, message times and
// day breaks, the reply box, and the tenant's phone link. Pure, so it is unit tested.

import { formatLongDate } from "./dates";
import { formatZwPhone } from "./phone";
import { ZIMBABWE_TZ } from "./rent-timing";

export const STATUS_VALUES = ["OPEN", "IN_PROGRESS", "PENDING_PARTS", "RESOLVED", "CLOSED"] as const;
export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ComplaintStatusValue = (typeof STATUS_VALUES)[number];
export type ComplaintPriorityValue = (typeof PRIORITY_VALUES)[number];

export function parseStatus(value: string): ComplaintStatusValue | null {
  return (STATUS_VALUES as readonly string[]).includes(value) ? (value as ComplaintStatusValue) : null;
}

export function parsePriority(value: string): ComplaintPriorityValue | null {
  return (PRIORITY_VALUES as readonly string[]).includes(value) ? (value as ComplaintPriorityValue) : null;
}

/** Marking a complaint done tells the tenant it is done, so it comes with an undo. */
export function needsUndo(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

// ---- Service clock -----------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
export const SLA_HOURS: Record<string, number> = { CRITICAL: 24, HIGH: 48, MEDIUM: 72, LOW: 168 };

export type Sla = { overdue: boolean; text: string };

/** How long is left to respond (or how late it is) for a complaint that is still open. */
export function slaStatus(createdAt: Date, priority: string, resolved: boolean, now: Date): Sla | null {
  if (resolved) return null;
  const deadline = createdAt.getTime() + (SLA_HOURS[priority] ?? 72) * HOUR_MS;
  const remainingMs = deadline - now.getTime();
  const hours = Math.abs(remainingMs) / HOUR_MS;
  const text = hours < 1 ? "<1h" : hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
  return { overdue: remainingMs < 0, text };
}

export function slaLabel(sla: Sla): string {
  return sla.overdue ? `Overdue by ${sla.text}` : `${sla.text} left to respond`;
}

// ---- Times and day breaks ---------------------------------------------

const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZIMBABWE_TZ,
});

/** "14:32" in Zimbabwe time. */
export function formatClock(date: Date): string {
  return clock.format(date);
}

/**
 * One entry per moment: the long date ("Wednesday, 14 October 2026") when it starts a new day in
 * Zimbabwe, otherwise null. The first moment always starts a day.
 */
export function dayBreaks(dates: Date[]): (string | null)[] {
  let previous: string | null = null;
  return dates.map((date) => {
    const label = formatLongDate(date);
    const starts = label !== previous;
    previous = label;
    return starts ? label : null;
  });
}

// ---- Messages ----------------------------------------------------------

export type ThreadMessage = {
  id: string;
  senderRole: string;
  senderName: string;
  body: string;
  imageUrls: string[];
  createdAt: Date;
};

/**
 * What the server has, plus replies sent from this screen that the server's copy has not caught
 * up with yet. A reply is dropped from the local list the moment the server's page contains it.
 */
export function mergeMessages<T extends ThreadMessage, L extends ThreadMessage>(server: T[], local: L[]): (T | L)[] {
  const known = new Set(server.map((m) => m.id));
  const pending = local.filter((m) => !known.has(m.id));
  return [...server, ...pending].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// ---- Reply box ---------------------------------------------------------

export const REPLY_MAX = 2000;

export function isSendable(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= REPLY_MAX;
}

/** Enter sends, Shift+Enter starts a new line, and Enter inside an input-method composition does neither. */
export function shouldSendOnKey(e: { key: string; shiftKey: boolean; isComposing: boolean }): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing;
}

/** Puts a reply that failed to send back in the box, ahead of anything typed since. */
export function restoreDraft(current: string, failed: string): string {
  return current.trim() ? `${failed}\n${current}` : failed;
}

// ---- Tenant phone ------------------------------------------------------

/** A tel: link for the tenant's number, or null if there is nothing diallable. */
export function telHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const formatted = formatZwPhone(raw);
  if (formatted.startsWith("+263 7")) return `tel:+${formatted.replace(/\D/g, "")}`;
  const dialable = raw.trim().replace(/[^\d+]/g, "");
  return dialable.replace(/\D/g, "").length >= 5 ? `tel:${dialable}` : null;
}
