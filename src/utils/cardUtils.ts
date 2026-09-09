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

/**
 * Tries to extract last 4 digits from a card number string or masked PAN
 * e.g. "444111******9876", "**** 1234", "5375 41** **** 4321", "•••• 9876"
 */
export function extractCardLast4(val?: string | number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const str = String(val).trim();
  if (!str) return undefined;

  // Masked or formatted card pattern ending in 4 digits
  const maskedMatch = str.match(/(?:(?:\*|•){2,}|\d{4})[^\d]*(\d{4})(?:\D|$)/);
  if (maskedMatch && isValidCardLast4(maskedMatch[1])) {
    return maskedMatch[1];
  }

  // Any trailing 4 digits
  const trailingMatch = str.match(/(\d{4})$/);
  if (trailingMatch && isValidCardLast4(trailingMatch[1])) {
    return trailingMatch[1];
  }

  // Full unmasked card number (16 digits)
  const digitsOnly = str.replace(/\D/g, '');
  if (digitsOnly.length >= 4) {
    const candidate = digitsOnly.slice(-4);
    if (isValidCardLast4(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Cleans a card name string by removing raw 16-digit/full masked PANs if present,
 * or returns a formatted clean card name.
 */
export function cleanCardName(val?: string, fallbackLast4?: string, defaultPrefix = 'Картка'): string {
  if (!val || !val.trim()) {
    return fallbackLast4 ? `${defaultPrefix} *${fallbackLast4}` : defaultPrefix;
  }
  const str = val.trim();
  // If string is purely a card number or mask, format it nicely
  if (/^[\d\s*•\-_]{8,}$/.test(str)) {
    const last4 = extractCardLast4(str) || fallbackLast4;
    return last4 ? `${defaultPrefix} *${last4}` : defaultPrefix;
  }
  return str;
}

