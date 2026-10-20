// An id for a reply, chosen on the screen before the first attempt to send it. The same id goes with
// a retry, so the server can tell "the same reply again" from "a second reply" (see
// addComplaintMessageForOrg). It only has to be unique, not secret, so older phones without a secure
// random source still get one.

type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

/** A reply whose send was started and not confirmed: the id it went out under, and its words. */
export type UnconfirmedReply = { id: string; body: string };

/**
 * The id to send `body` under. The same words as a send that was never confirmed reuse its id, so
 * the server recognises a retry of a reply whose response was lost. Different words, or no
 * unconfirmed send, are a new reply and get a new id.
 */
export function idForReply(unconfirmed: UnconfirmedReply | null, body: string, make: () => string = newMessageId): string {
  return unconfirmed && unconfirmed.body === body ? unconfirmed.id : make();
}

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newMessageId(source: RandomSource | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof source?.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);

  // Version 4, RFC 4122 variant: the shape the server's uuid check accepts.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
