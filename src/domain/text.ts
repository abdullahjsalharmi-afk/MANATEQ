/**
 * Small text helpers for the words the domain and the state write into the demo world (document
 * titles, invoice titles, notifications). Pure.
 */

/** NO-BREAK SPACE. */
const NBSP = String.fromCharCode(0xa0);
/** WORD JOINER: invisible, forbids a line break where it stands. */
const WJ = String.fromCharCode(0x2060);
const HYPHEN_BREAK = new RegExp(`(\\S)-(?=[^\\s${WJ}])`, 'g');

/**
 * A code, a reference or a date that must never break across lines: "AW-116" and "27 أغسطس 2026" stay
 * whole. A word joiner follows each hyphen (the hyphen itself is unchanged, so the code still reads and
 * copies as typed) and spaces become no-break spaces. The same rule as `ltr()` in `@/app/i18n`, which
 * applies it inside Arabic: use this for the English side. Only for display text, never for ids.
 */
export function keepWhole(text: string): string {
  return text.replace(HYPHEN_BREAK, `$1-${WJ}`).replace(/ /g, NBSP);
}

/**
 * The separator of an inline list ("A · B · C"). The dot is held to the item that follows it, so a line
 * never ends or starts with a dot standing on its own.
 */
export const DOT = ` ·${NBSP}`;
