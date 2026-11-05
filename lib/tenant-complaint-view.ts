// What a tenant reads about their own complaint: whether the landlord has replied, a one-line
// preview for the list, and who a message is from. Pure, so it is unit tested.

/** "1 reply from your landlord", or null when there is none. */
export function replyLabel(landlordReplies: number): string | null {
  if (landlordReplies <= 0) return null;
  return landlordReplies === 1 ? "1 reply from your landlord" : `${landlordReplies} replies from your landlord`;
}

/** A reply on one line for the list: whitespace collapsed, cut at `max` characters with an ellipsis. */
export function previewText(body: string, max = 100): string {
  const chars = Array.from(body.replace(/\s+/g, " ").trim());
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** Who a message is from, as the tenant reads it. */
export function senderLabel(role: string): string {
  if (role === "LANDLORD") return "Your landlord";
  if (role === "TENANT") return "You";
  return "PropFlow";
}
