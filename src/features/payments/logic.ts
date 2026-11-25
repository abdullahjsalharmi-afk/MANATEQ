/**
 * Pure helpers of payments: what the due line of an invoice says, and how the statement groups paid
 * invoices by month. No React here, so the rules can be unit-tested.
 */
import type { Invoice } from '@/domain/types';

export const DAY_MS = 86_400_000;

/** How close a due date must be before the line turns to a warning. */
export const SOON_DAYS = 14;

export type DueLine =
  | { kind: 'paid'; tone: 'ok'; at: number }
  | { kind: 'overdue'; tone: 'bad'; days: number; at: number }
  | { kind: 'today'; tone: 'warn'; at: number }
  | { kind: 'soon'; tone: 'warn'; days: number; at: number }
  | { kind: 'later'; tone: 'neutral'; at: number };

/** Whole calendar days from `from` to `to` (negative when `to` is earlier), counted on local midnights. */
export function calendarDays(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * The one line that says where an invoice stands: paid on a date, overdue for some days, due today,
 * due soon (in days) or due on a later date. An unpaid invoice past its date is overdue even before
 * the calendar has marked it so.
 */
export function dueLine(invoice: Invoice, now: number): DueLine {
  if (invoice.status === 'paid') return { kind: 'paid', tone: 'ok', at: invoice.paidAt ?? invoice.issuedAt };
  const days = calendarDays(now, invoice.dueAt);
  if (invoice.status === 'overdue' || days < 0) return { kind: 'overdue', tone: 'bad', days: Math.max(1, -days), at: invoice.dueAt };
  if (days === 0) return { kind: 'today', tone: 'warn', at: invoice.dueAt };
  if (days <= SOON_DAYS) return { kind: 'soon', tone: 'warn', days, at: invoice.dueAt };
  return { kind: 'later', tone: 'neutral', at: invoice.dueAt };
}

export interface MonthGroup {
  /** "2026-08" */
  key: string;
  /** The first day of the month, for display. */
  at: number;
  invoices: Invoice[];
  total: number;
}

/** Paid invoices grouped by the month they were paid in, the latest month and payment first. */
export function groupByMonth(invoices: readonly Invoice[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const invoice of invoices) {
    if (invoice.status !== 'paid') continue;
    const paidAt = invoice.paidAt ?? invoice.issuedAt;
    const date = new Date(paidAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, at: new Date(date.getFullYear(), date.getMonth(), 1).getTime(), invoices: [], total: 0 };
      groups.set(key, group);
    }
    group.invoices.push(invoice);
    group.total += invoice.amount;
  }
  const paidAt = (invoice: Invoice) => invoice.paidAt ?? invoice.issuedAt;
  return [...groups.values()]
    .sort((a, b) => b.at - a.at)
    .map((group) => ({ ...group, invoices: group.invoices.sort((a, b) => paidAt(b) - paidAt(a)) }));
}

/** Outstanding invoices, the soonest due first. */
export function outstanding(invoices: readonly Invoice[]): Invoice[] {
  return invoices.filter((invoice) => invoice.status !== 'paid').sort((a, b) => a.dueAt - b.dueAt);
}
