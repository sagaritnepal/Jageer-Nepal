// lib/utils/phone.ts

/** A customer's phone number must be exactly 10 digits to be saved. */
export function isValidPhone10(phone: string): boolean {
  return /^\d{10}$/.test(phone.trim());
}

/** Phone-contacts entries and other free-text sources carry spaces,
 * dashes, and country codes (e.g. "+977 981-234-5678") - squeeze down to
 * the bare 10-digit shape every saved customer's `phone` is stored in
 * (see isValidPhone10 above), so a picked/typed number actually matches
 * an existing customer instead of silently creating an unlinked duplicate.
 * Returns null if it can't be squeezed down to a plausible 10-digit number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return null;
}
