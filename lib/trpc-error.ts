// Turns a tRPC client error into something a landlord can act on. Errors the server throws on
// purpose already carry plain-language messages; what leaks is Zod's JSON dump for invalid input
// and transport failures like "Failed to fetch", which mean nothing to the person reading them.

export function friendlyMessage(
  err: { message: string },
  fallback = "Something went wrong. Please try again.",
): string {
  const message = err.message?.trim() ?? "";
  if (!message) return fallback;
  if (message.startsWith("[") || message.startsWith("{")) {
    return "Some details look wrong. Check the form and try again.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Couldn't reach PropFlow. Check your connection and try again.";
  }
  return message;
}
