/**
 * Utility functions for bank card masking and formatting
 */

/**
 * Strips non-digits and restricts to at most 4 characters
 */
export function sanitizeCardLast4(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

/**
 * Returns true if exactly 4 digits
 */
export function isValidCardLast4(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

/**
 * Formats 4 digits into full masked card format:
 * e.g. "1234" -> "**** **** **** 1234"
 */
export function formatCardMask(last4?: string): string {
  if (!last4) return '';
  const digits = sanitizeCardLast4(last4);
  if (!digits) return '';
  return `**** **** **** ${digits}`;
}

/**
 * Formats 4 digits into a compact badge representation:
 * e.g. "1234" -> "•••• 1234"
 */
export function formatCardCompact(last4?: string): string {
  if (!last4) return '';
  const digits = sanitizeCardLast4(last4);
  if (!digits) return '';
  return `•••• ${digits}`;
}
