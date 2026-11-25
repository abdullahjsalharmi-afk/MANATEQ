/** Gate pass validity and details: quick picks, custom dates and what each pass type needs. Pure. */
import type { PassKind } from '@/domain/types';

export const QUICK_VALIDITY = ['today', 'days3', 'week', 'month'] as const;
export type QuickValidity = (typeof QUICK_VALIDITY)[number];
export type Validity = QuickValidity | 'custom';

const DAYS: Record<QuickValidity, number> = { today: 1, days3: 3, week: 7, month: 30 };

/** Midnight at the start of the local day of `ms`. */
export function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The last millisecond of the local day `days - 1` days after the day of `start`. */
export function endOfLocalDay(start: number, days = 1): number {
  const date = new Date(start);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime() - 1;
}

export interface Range {
  from: number;
  to: number;
}

/** A quick pick as a range of whole local days starting today. */
export function quickRange(choice: QuickValidity, now: number): Range {
  const from = startOfLocalDay(now);
  return { from, to: endOfLocalDay(from, DAYS[choice]) };
}

/**
 * Custom dates (ms of each day's start) as a range of whole days, or the reason it is not valid:
 * a missing day, a start before today, or an end before the start.
 */
export function customRange(fromDay: number | null, toDay: number | null, now: number): Range | 'missing' | 'past' | 'order' {
  if (fromDay === null || toDay === null) return 'missing';
  const from = startOfLocalDay(fromDay);
  if (from < startOfLocalDay(now)) return 'past';
  if (toDay < from) return 'order';
  return { from, to: endOfLocalDay(toDay) };
}

/** What the investor types for each kind of pass. */
export interface PassDetails {
  name: string;
  /** Personal ID number (worker). */
  qid: string;
  /** Plate number (vehicle). */
  plate: string;
  /** Company (visitor, optional). */
  company: string;
  /** The visitor's mobile number, where the pass would be sent (visitor, required). */
  phone: string;
}

export type DetailError = 'name' | 'qid' | 'plate' | 'phone';

/** A mobile number as typed: digits with optional spaces, dashes, brackets and a leading +, 8 to 15 digits. */
export function isPhone(text: string): boolean {
  const value = text.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 8 && digits <= 15;
}

/** A personal ID number as typed: the eleven digits of a QID, with optional spaces. */
export function isQid(text: string): boolean {
  return /^\d{11}$/.test(text.replace(/\s/g, ''));
}

/** The details a pass type cannot do without that are missing, or not in the form they must have. */
export function missingDetails(kind: PassKind, details: PassDetails): DetailError[] {
  const missing: DetailError[] = [];
  if (!details.name.trim()) missing.push('name');
  if (kind === 'worker' && !isQid(details.qid)) missing.push('qid');
  if (kind === 'vehicle' && !details.plate.trim()) missing.push('plate');
  if (kind === 'visitor' && !isPhone(details.phone)) missing.push('phone');
  return missing;
}

/** The number on the pass: the ID for a worker, the plate for a vehicle, nothing for a visitor. */
export function idOrPlateOf(kind: PassKind, details: PassDetails): string | undefined {
  const value = kind === 'worker' ? details.qid.replace(/\s/g, '') : kind === 'vehicle' ? details.plate.trim().toUpperCase() : '';
  return value || undefined;
}
