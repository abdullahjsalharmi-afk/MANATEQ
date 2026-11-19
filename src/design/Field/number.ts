/**
 * Reading numbers the way people type them: Western, Arabic-Indic or Persian digits, with or without
 * grouping marks. Pure functions, used by `NumberField`.
 */

const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** Longest number a field accepts: enough for any amount or area, and always exact. */
export const MAX_DIGITS = 12;

/** Turns ٠-٩ and ۰-۹ into 0-9 and the Arabic decimal mark into a point. */
export function toWesternDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/٫/g, '.');
}

/**
 * Keeps only what can be part of a number while someone is typing: digits, grouping commas and, when
 * decimals are allowed, one decimal point. Letters and symbols never appear in the field.
 */
export function cleanNumberInput(text: string, decimals = 0): string {
  let out = toWesternDigits(text).replace(/[٬،]/g, ',').replace(/[^\d.,]/g, '');
  if (decimals <= 0) {
    // A whole-number field drops the fraction instead of gluing its digits on (12.7 is 12, never 127).
    out = out.split('.')[0] ?? '';
  } else {
    const point = out.indexOf('.');
    if (point !== -1) {
      const whole = out.slice(0, point);
      const fraction = out
        .slice(point + 1)
        .replace(/[.,]/g, '')
        .slice(0, decimals);
      out = `${whole}.${fraction}`;
    }
  }
  // Limit the count of digits, not of characters, so grouping marks never eat into the limit.
  let digits = 0;
  let limited = '';
  for (const char of out) {
    if (char >= '0' && char <= '9') {
      digits += 1;
      if (digits > MAX_DIGITS) break;
    }
    limited += char;
  }
  return limited;
}

/**
 * Reads typed text as a number, or returns null when there is none.
 * `'١٨٬٧٥٠'`, `'18,750'` and `' 18 750 '` all read as 18750.
 */
export function parseNumber(text: string, decimals = 0): number | null {
  const plain = toWesternDigits(text).replace(/[\s,٬،_'’]/g, '');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(plain)) return null;
  const value = Number(plain);
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** Math.max(0, decimals);
  return Math.round(value * factor) / factor;
}
