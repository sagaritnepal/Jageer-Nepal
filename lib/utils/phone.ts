// lib/utils/phone.ts

/** A customer's phone number must be exactly 10 digits to be saved. */
export function isValidPhone10(phone: string): boolean {
  return /^\d{10}$/.test(phone.trim());
}
