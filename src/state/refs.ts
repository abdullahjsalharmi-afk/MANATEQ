/**
 * Ids and human-readable references. Every new record takes the next number of `world.seq`, so
 * references never repeat inside a demo world:
 *
 *   requests   MQ-2611-0042      (year, month, number)
 *   invoices   INV-2026-0043     receipts  RCP-2026-0043 (the invoice's own number)
 *   leases     LC-2026-0044
 *   documents  NOC-2611-0045     (prefix by kind, see DOC_REF_PREFIX)
 */
import { DOC_REF_PREFIX } from '@/domain/documents';
import type { DocKind, World } from '@/domain/types';

export type IdPrefix = 'r' | 'd' | 'inv' | 'n' | 'gp' | 'ap' | 'pl' | 'ls';

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** "2611" for November 2026. */
function yearMonth(at: number): string {
  const date = new Date(at);
  return `${pad(date.getFullYear() % 100, 2)}${pad(date.getMonth() + 1, 2)}`;
}

const year = (at: number): number => new Date(at).getFullYear();

/** The last four digits of a sequence number. */
const serial = (seq: number): string => pad(seq % 10_000, 4);

export const requestRef = (seq: number, at: number): string => `MQ-${yearMonth(at)}-${serial(seq)}`;
export const invoiceRef = (seq: number, at: number): string => `INV-${year(at)}-${serial(seq)}`;
export const leaseRef = (seq: number, at: number): string => `LC-${year(at)}-${serial(seq)}`;
export const docRef = (kind: DocKind, seq: number, at: number): string => `${DOC_REF_PREFIX[kind]}-${yearMonth(at)}-${serial(seq)}`;

/** A receipt carries the number of the invoice it settles. */
export const receiptRefFor = (invoice: string): string => invoice.replace(/^INV-/, 'RCP-');

const PASS_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** The code printed on a gate pass and held in its QR: "GP-7K2M4Q". */
export function passCode(seq: number): string {
  // A small multiplicative scramble, so consecutive passes do not look consecutive.
  let value = (Math.imul(seq + 1, 0x9e3779b1) >>> 0) % PASS_ALPHABET.length ** 6;
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += PASS_ALPHABET[value % PASS_ALPHABET.length];
    value = Math.floor(value / PASS_ALPHABET.length);
  }
  return `GP-${code}`;
}

/** Takes the next sequence number: returns the world with the counter moved on, the number and the record id. */
export function allocate(world: World, prefix: IdPrefix): { world: World; seq: number; id: string } {
  const seq = world.seq + 1;
  return { world: { ...world, seq }, seq, id: `${prefix}${seq}` };
}
