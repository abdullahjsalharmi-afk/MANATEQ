import type { ReactNode } from 'react';
import styles from './List.module.css';

/**
 * Runs of text that must never break across lines: codes and reference numbers (a hyphen is otherwise a line-break
 * opportunity, so «AW-116» splits into «AW-» / «116»), dates («27 أغسطس 2026», «13 Oct 2026») and clock times
 * («6:00 pm», «11:59 م»). It also holds for text that already carries the formatters' word joiners and no-break
 * spaces, so the two guards never fight.
 */
const WHOLE = new RegExp(
  [
    // Codes: two or more capitals, then hyphenated groups of capitals and digits (BA-121, RCP-2026-0051, TSD-58SD-7KX8).
    String.raw`[A-Z]{2,}[A-Z0-9]*(?:[-\u2011]\u2060?[A-Z0-9]+)+`,
    // Dates: day, month name, year.
    String.raw`\d{1,2}\s[\p{L}]+\.?\s\d{4}`,
    // Clock times with their period.
    String.raw`\d{1,2}:\d{2}\s?(?:[aApP]\.?[mM]\.?|ص|م)(?![\p{L}])`,
  ].join('|'),
  'gu',
);

/** True when `text` is a string with a code, a date or a time in it. */
export function hasWhole(text: ReactNode): boolean {
  if (typeof text !== 'string') return false;
  WHOLE.lastIndex = 0;
  const found = WHOLE.test(text);
  WHOLE.lastIndex = 0;
  return found;
}

/** Wraps every code, date and time in `text` in a no-wrap span. Anything that is not a string is returned as it is. */
export function keepWhole(text: ReactNode): ReactNode {
  if (typeof text !== 'string') return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(WHOLE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <span key={start} className={styles.whole}>
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (parts.length === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** `keepWhole` as a component, for a title or value built elsewhere. */
export function Whole({ children }: { children: ReactNode }) {
  return <>{keepWhole(children)}</>;
}
