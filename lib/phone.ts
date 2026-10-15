// Zimbabwe mobile numbers in the product's one display format: +263 7X XXX XXXX.

/**
 * Formats a stored number for display. Accepts +263771234567, 263771234567, 0771234567 and
 * 771234567, with or without spaces. Anything that is not a Zimbabwe mobile number is returned
 * trimmed and otherwise untouched, rather than guessed at.
 */
export function formatZwPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let national: string | null = null;
  if (digits.startsWith("263") && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;

  if (national && /^7\d{8}$/.test(national)) {
    return `+263 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  return raw.trim();
}
