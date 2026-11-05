// Tenant invitations. There is no invitations table: a landlord's invite is a Clerk invitation
// that carries the unit in its publicMetadata (lib/routers/tenants.ts creates it, and
// app/api/webhooks/clerk turns it into a User + Tenancy when the tenant signs up). Clerk is
// therefore the source of truth for "who has been invited and hasn't joined yet", and this file
// holds the pure rules around reading that back: which invitations belong to which unit, when a
// resend is allowed, and what a failed send is allowed to say. No Clerk imports, so it is testable.

import { unitLabel } from "./unit-display";

/** How long an invitation link works. Passed to Clerk explicitly so the expiry we show is true. */
export const INVITE_TTL_DAYS = 30;

/** Resending is blocked this long after the last send, so a double tap can't email a tenant twice. */
export const RESEND_COOLDOWN_SECONDS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

export type InviteMetadata = { unitId: string; name: string | null; rentDueDay: number };

/** The unit assignment a landlord put on an invitation, or null for any other kind of invitation. */
export function parseInviteMetadata(metadata: Record<string, unknown> | null | undefined): InviteMetadata | null {
  if (!metadata || metadata.role !== "TENANT") return null;
  if (typeof metadata.unitId !== "string" || metadata.unitId === "") return null;
  const day = typeof metadata.rentDueDay === "number" && Number.isInteger(metadata.rentDueDay) ? metadata.rentDueDay : 1;
  return {
    unitId: metadata.unitId,
    name: typeof metadata.name === "string" && metadata.name.trim() !== "" ? metadata.name.trim() : null,
    rentDueDay: Math.min(28, Math.max(1, day)),
  };
}

/** The slice of a Clerk Invitation this file needs (the SDK's class satisfies it). */
export type InvitationLike = {
  id: string;
  emailAddress: string;
  status: string;
  /** Unix milliseconds. */
  createdAt: number;
  publicMetadata: Record<string, unknown> | null;
};

export type InvitationPage = { data: InvitationLike[]; totalCount: number };

/**
 * Reads pending invitations a page at a time, newest first, until none are left or `maxPages` pages
 * have been read. `truncated` is true when the ceiling stopped the scan with invitations still
 * unread, so the caller can say the list is incomplete instead of silently dropping the oldest.
 */
export async function scanInvitations(
  fetchPage: (offset: number, limit: number) => Promise<InvitationPage>,
  { pageSize, maxPages }: { pageSize: number; maxPages: number },
): Promise<{ all: InvitationLike[]; truncated: boolean }> {
  const all: InvitationLike[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, totalCount } = await fetchPage(page * pageSize, pageSize);
    all.push(...data);
    if (data.length < pageSize || all.length >= totalCount) return { all, truncated: false };
  }
  return { all, truncated: true };
}

export type PendingInvite = {
  id: string;
  name: string;
  email: string;
  unitId: string;
  /** "Unit 04 · Borrowdale Flats" */
  unitLabel: string;
  rentDueDay: number;
  /** Unix milliseconds. */
  invitedAt: number;
  expiresAt: number;
};

export type InvitableUnit = { unitNumber: string; propertyName: string };

/**
 * The pending invitations that belong to this landlord's units, newest first. `units` must come
 * from an org-scoped read of the landlord's own vacant units: an invitation whose unit isn't in
 * the map belongs to someone else (or to a unit that has since been filled) and is left out.
 */
export function toPendingInvites(
  invitations: readonly InvitationLike[],
  units: ReadonlyMap<string, InvitableUnit>,
  now: number,
): PendingInvite[] {
  const invites: PendingInvite[] = [];
  for (const inv of invitations) {
    if (inv.status !== "pending") continue;
    const meta = parseInviteMetadata(inv.publicMetadata);
    if (!meta) continue;
    const unit = units.get(meta.unitId);
    if (!unit) continue;
    const expiresAt = inv.createdAt + INVITE_TTL_DAYS * DAY_MS;
    if (expiresAt <= now) continue;
    invites.push({
      id: inv.id,
      name: meta.name ?? inv.emailAddress,
      email: inv.emailAddress,
      unitId: meta.unitId,
      unitLabel: unitLabel(unit),
      rentDueDay: meta.rentDueDay,
      invitedAt: inv.createdAt,
      expiresAt,
    });
  }
  return invites.sort((a, b) => b.invitedAt - a.invitedAt);
}

/** Seconds until another send is allowed; 0 when it is allowed now. */
export function resendWaitSeconds(invitedAt: number, now: number): number {
  const waited = Math.floor((now - invitedAt) / 1000);
  return Math.max(0, RESEND_COOLDOWN_SECONDS - Math.max(waited, 0));
}

/**
 * Why the invite button is off, in a sentence, or null when there is a unit to invite onto.
 * `unitCount` is every unit the landlord has; `vacantCount` is how many are vacant;
 * `pendingCount` is how many of those already have an invitation waiting.
 */
export function noInviteReason(counts: { unitCount: number; vacantCount: number; pendingCount: number }): string | null {
  const { unitCount, vacantCount, pendingCount } = counts;
  if (unitCount === 0) return "Add a unit first. A tenant is invited onto a specific unit.";
  if (vacantCount === 0) return "Every unit already has a tenant.";
  if (pendingCount >= vacantCount) return "Every vacant unit already has an invitation waiting. Resend or cancel one below.";
  return null;
}

type ClerkApiError = { code?: unknown };

/** Clerk's machine codes for a failed call (e.g. "form_param_format_invalid"). Never the message text. */
export function clerkErrorCodes(err: unknown): string[] {
  const errors = (err as { errors?: ClerkApiError[] } | null)?.errors;
  if (!Array.isArray(errors)) return [];
  return errors.map((e) => e?.code).filter((c): c is string => typeof c === "string");
}

function clerkStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

export type InviteFailure = {
  trpcCode: "BAD_REQUEST" | "CONFLICT" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR";
  /** Safe to show the landlord. Clerk's own wording is never passed through: it can echo the email. */
  message: string;
  /** What to log: status and codes only, no email or name. */
  log: { status: number | null; codes: string[] };
};

/** Turns a failed Clerk call into a landlord-safe message and a PII-free log entry. */
export function inviteFailure(err: unknown): InviteFailure {
  const codes = clerkErrorCodes(err);
  const status = clerkStatus(err);
  const log = { status, codes };
  const has = (...wanted: string[]) => codes.some((c) => wanted.includes(c));

  if (has("duplicate_record", "form_identifier_exists", "invitation_already_exists")) {
    return {
      trpcCode: "CONFLICT",
      message:
        "That email address already has a PropFlow account or a pending invitation. Ask them to sign in, or invite a different email address.",
      log,
    };
  }
  if (has("form_param_format_invalid", "form_param_nil", "form_param_value_invalid", "invalid_email_address")) {
    return { trpcCode: "BAD_REQUEST", message: "That email address doesn't look right. Check the spelling and try again.", log };
  }
  if (status === 429) {
    return { trpcCode: "TOO_MANY_REQUESTS", message: "Too many invitations in a short time. Wait a minute and try again.", log };
  }
  // Clerk's documentation does not list the error codes createInvitation returns when an address
  // is already invited or already has an account (it only says the call fails unless
  // ignoreExisting is set), so the codes above are best guesses. A 422 is Clerk refusing the
  // address itself, so whatever the code turns out to be, the landlord is told what to do rather
  // than that something went wrong. The code is logged (see inviteFailure's log), which names it.
  if (status === 422) {
    return {
      trpcCode: "BAD_REQUEST",
      message:
        "We couldn't invite that email address. It may already have a PropFlow account or a pending invitation, or it may not be accepted. Check it, or invite a different email address.",
      log,
    };
  }
  return {
    trpcCode: "INTERNAL_SERVER_ERROR",
    message: "We couldn't send the invitation just now. Please try again in a moment.",
    log,
  };
}
