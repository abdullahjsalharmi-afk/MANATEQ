/**
 * Pure helpers of the wallet: how documents are filtered, how a verification code is read and matched,
 * and how a pass's validity is described. No React here, so the rules can be unit-tested.
 */
import type { Lang } from '@/data/types';
import type { Doc, DocKind, Pass } from '@/domain/types';

/** The filters of the documents list, in display order. */
export const DOC_FILTERS = ['all', 'contracts', 'certificates', 'receipts', 'approvals'] as const;
export type DocFilter = (typeof DOC_FILTERS)[number];

const FILTER_OF_KIND: Record<DocKind, Exclude<DocFilter, 'all'>> = {
  contract: 'contracts',
  offer: 'contracts',
  certificate: 'certificates',
  noc: 'certificates',
  receipt: 'receipts',
  statement: 'receipts',
  permit: 'approvals',
  letter: 'approvals',
  report: 'approvals',
};

export function filterOfKind(kind: DocKind): Exclude<DocFilter, 'all'> {
  return FILTER_OF_KIND[kind];
}

/** The documents a filter shows, the newest first. */
export function filterDocs(docs: readonly Doc[], filter: DocFilter): Doc[] {
  const shown = filter === 'all' ? docs.slice() : docs.filter((doc) => FILTER_OF_KIND[doc.kind] === filter);
  return shown.sort((a, b) => b.issuedAt - a.issuedAt);
}

/** How many documents each filter would show. */
export function countByFilter(docs: readonly Doc[]): Record<DocFilter, number> {
  const counts: Record<DocFilter, number> = { all: docs.length, contracts: 0, certificates: 0, receipts: 0, approvals: 0 };
  for (const doc of docs) counts[FILTER_OF_KIND[doc.kind]]++;
  return counts;
}

/**
 * Reads what someone typed or pasted as a verification code: case, spaces and dashes do not matter,
 * and a code typed without its "TSD" prefix is still recognised. Returns the canonical "TSD-XXXX-XXXX"
 * form, or the cleaned text when it does not have the shape of a code.
 */
export function normalizeCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = bare.startsWith('TSD') ? bare.slice(3) : bare;
  if (body.length === 8) return `TSD-${body.slice(0, 4)}-${body.slice(4)}`;
  return bare;
}

/** Whether the text has the shape of a verification code (it may still not exist). */
export function isCodeShape(input: string): boolean {
  return /^TSD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizeCode(input));
}

/** Finds the document a verification code belongs to. */
export function findByCode(docs: readonly Doc[], input: string): Doc | undefined {
  const code = normalizeCode(input);
  if (!code) return undefined;
  return docs.find((doc) => normalizeCode(doc.verifyCode) === code);
}

/** What the QR of a document carries: the public verification address with the code. */
export function verifyUrl(code: string): string {
  return `https://one.manateq.example/#/verify?code=${encodeURIComponent(code)}`;
}

/** The in-app route of the public verification page for a code. */
export function verifyRoute(code: string): string {
  return `/verify?code=${encodeURIComponent(code)}`;
}

export type PassValidity = { state: 'valid'; until: number } | { state: 'upcoming'; from: number } | { state: 'expired'; at: number } | { state: 'revoked' };

/** Whether a pass can be used now, judged by its status and its dates. */
export function passValidity(pass: Pass, now: number): PassValidity {
  if (pass.status === 'revoked') return { state: 'revoked' };
  if (pass.status === 'expired' || pass.to < now) return { state: 'expired', at: pass.to };
  if (pass.from > now) return { state: 'upcoming', from: pass.from };
  return { state: 'valid', until: pass.to };
}

/**
 * Demo holders are sometimes stored in both languages, "زائر تجريبي · Demo visitor".
 * Shows the half in the reading language; any other name is shown as written.
 */
export function holderName(holder: string, lang: Lang): string {
  const parts = holder.split(' · ');
  if (parts.length !== 2) return holder;
  const [first, second] = parts as [string, string];
  const arabic = (text: string) => /[؀-ۿ]/.test(text);
  if (arabic(first) === arabic(second)) return holder;
  const ar = arabic(first) ? first : second;
  const en = arabic(first) ? second : first;
  return lang === 'ar' ? ar : en;
}

/** One piece of a display text: plain words, or a code ("BA-121", "RCP-2026-0049") that must stay whole. */
export type TextPart = { code: false; text: string } | { code: true; text: string };

const CODE = /[A-Z]{2,}[A-Z0-9]*(?:[-\u2011]\u2060?[A-Z0-9]+)+/g;
const SEPARATOR = ' · ';

/**
 * Splits a title such as "Rent, Q4 2026 · BA-121" into words and codes, so that a code is drawn
 * unbroken and left to right. The separator dot keeps to the part after it ("· BA-121"), so it never
 * hangs alone at the end of a line.
 */
export function splitCodes(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const glued = (words: string) => words.split(SEPARATOR).join(' ·\u00A0');
  for (const match of text.matchAll(CODE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ code: false, text: glued(text.slice(last, at)) });
    parts.push({ code: true, text: match[0] });
    last = at + match[0].length;
  }
  if (last < text.length) parts.push({ code: false, text: glued(text.slice(last)) });
  return parts;
}

/** A short value (a date, a time) whose words must not part on two lines: its spaces become no-break spaces. */
export function unbroken(text: string): string {
  return text.replace(/\s/g, '\u00A0');
}

/**
 * A moment of a pass, "25 Nov 2026, 12:00 am" / «25 نوفمبر 2026، 12:00 ص»: the date and the time each stay
 * whole, so a narrow column breaks only between them. Used by the pass viewer and the pass flow's
 * confirmation, so a one-day pass always shows its hours.
 */
export function passMoment(ms: number, fmt: { date: (ms: number) => string; time: (ms: number) => string }, lang: Lang): string {
  return `${unbroken(fmt.date(ms))}${lang === 'ar' ? '، ' : ', '}${unbroken(fmt.time(ms))}`;
}

/** Documents grouped by the year they were issued, keeping their order (the newest first). */
export function byYear(docs: readonly Doc[]): { year: number; docs: Doc[] }[] {
  const groups: { year: number; docs: Doc[] }[] = [];
  for (const doc of docs) {
    const year = new Date(doc.issuedAt).getFullYear();
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.docs.push(doc);
    else groups.push({ year, docs: [doc] });
  }
  return groups;
}
