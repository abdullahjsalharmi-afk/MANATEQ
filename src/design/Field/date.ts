/**
 * Calendar dates as `YYYY-MM-DD` strings: what a native date input speaks, free of time zones and
 * plain JSON. These helpers move between that form and the milliseconds the formatters take.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local noon of the given calendar date, or null when the text is not a real date. */
export function isoDateToMs(iso: string | null | undefined): number | null {
  const match = iso ? ISO_DATE.exec(iso) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Noon keeps the calendar day stable when clocks change.
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

/** The local calendar date of a moment, as `YYYY-MM-DD`. */
export function msToIsoDate(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
