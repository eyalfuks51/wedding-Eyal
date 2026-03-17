/**
 * Phone normalization utilities for Israeli mobile numbers.
 *
 * normalizePhone: returns 972-prefixed international format for storage in
 *   invitations.phone_numbers[]. Used client-side before writing to DB.
 *
 * isValidPhone: validates that a phone string contains 9–12 digits after
 *   stripping non-digit characters. Allows standard Israeli formats.
 *
 * NOTE: The Supabase `phone_core` DB function strips all non-digits and returns
 * ONLY core digits (e.g. "521234567"). That is intentionally different from
 * normalizePhone() — both are correct for their respective contexts.
 */

/**
 * Normalize a raw phone string to 972-prefixed international format.
 * - Strips all non-digit characters
 * - Converts 0-prefix (Israeli local) to 972-prefix
 * - Passes through numbers already starting with 972
 * - Returns digits as-is for any other format
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

/**
 * Return true if the phone number contains 9–12 digits after stripping
 * non-digit characters. Accepts all common Israeli formats.
 */
export function isValidPhone(raw: string): boolean {
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}
