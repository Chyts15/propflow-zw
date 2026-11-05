// Error wording for the tenant portal. friendlyMessage (lib/trpc-error.ts) handles Zod dumps and
// dropped connections; this adds the one gap it leaves: a procedure that throws a bare TRPCError
// code (UNAUTHORIZED when a session has expired, FORBIDDEN) arrives with the code as its message,
// which means nothing to a tenant.

import { friendlyMessage } from "./trpc-error";

const GENERIC = "Something went wrong. Please try again.";

export function tenantErrorMessage(err: { message: string }, fallback = GENERIC): string {
  const message = err.message?.trim() ?? "";
  if (message === "UNAUTHORIZED") return "Your session has ended. Please sign in again.";
  if (message === "FORBIDDEN") return "That isn't available on your account.";
  // Any other bare code (INTERNAL_SERVER_ERROR, TOO_MANY_REQUESTS without a message, ...).
  if (/^[A-Z][A-Z_]{3,}$/.test(message)) return fallback;
  return friendlyMessage(err, fallback);
}
