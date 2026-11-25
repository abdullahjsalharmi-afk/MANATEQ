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
