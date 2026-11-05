// Ids chosen on the screen before the first attempt to send something, and sent again with a retry,
// so the server can tell "the same thing again" from "a second thing" (see addComplaintMessageForOrg
// and createComplaintForTenant). They only have to be unique, not secret, so older phones without a
// secure random source still get one.

type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

/** A send that was started and not confirmed: the id it went out under, and what it said. */
export type UnconfirmedAttempt = { id: string; content: string };

/**
 * The id to send `content` under. The same content as an attempt that was never confirmed reuses its
 * id, so the server recognises a retry of one whose response was lost. Different content, or no
 * unconfirmed attempt, is something new and gets a new id.
 */
export function idForAttempt(unconfirmed: UnconfirmedAttempt | null, content: string, make: () => string): string {
  return unconfirmed && unconfirmed.content === content ? unconfirmed.id : make();
}

function randomBytes(length: number, source: RandomSource | undefined): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** An id for a complaint reply. */
export function newMessageId(source: RandomSource | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID();

  const bytes = randomBytes(16, source);
  // Version 4, RFC 4122 variant: the shape the server's uuid check accepts.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A client-chosen complaint id is exactly this shape: a "c" and 24 lowercase letters or digits. */
export const CLIENT_CUID = /^c[a-z0-9]{24}$/;

/**
 * An id for a new complaint. Complaint ids appear in URLs and every router checks them as a cuid,
 * so this is cuid-shaped (what CLIENT_CUID accepts) rather than a UUID.
 */
export function newComplaintId(source: RandomSource | undefined = globalThis.crypto): string {
  return `c${toHex(randomBytes(12, source))}`;
}
