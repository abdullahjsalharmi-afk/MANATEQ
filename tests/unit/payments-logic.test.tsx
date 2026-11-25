import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/domain/types';
import { calendarDays, dueLine, groupByMonth, outstanding } from '@/features/payments/logic';
import { receiptRefFor } from '@/state/refs';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 25, 10, 0).getTime();

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'i',
  ref: 'INV-2026-0051',
  title: { ar: 'إيجار', en: 'Rent' },
  amount: 100,
  issuedAt: NOW - 30 * DAY,
  dueAt: NOW + 5 * DAY,
  status: 'due',
  ...over,
});

describe('due line', () => {
  it('counts calendar days, not hours', () => {
    expect(calendarDays(new Date(2026, 10, 25, 23, 0).getTime(), new Date(2026, 10, 26, 1, 0).getTime())).toBe(1);
    expect(calendarDays(NOW, NOW)).toBe(0);
  });
  it('warns when the due date is close', () => {
    expect(dueLine(invoice({}), NOW)).toEqual({ kind: 'soon', tone: 'warn', days: 5, at: NOW + 5 * DAY });
    expect(dueLine(invoice({ dueAt: NOW + 2 * 3_600_000 }), NOW).kind).toBe('today');
  });
  it('is neutral for a far date', () => {
    expect(dueLine(invoice({ dueAt: NOW + 40 * DAY }), NOW)).toMatchObject({ kind: 'later', tone: 'neutral' });
  });
  it('is bad when overdue, by status or by date', () => {
    expect(dueLine(invoice({ dueAt: NOW - 3 * DAY }), NOW)).toMatchObject({ kind: 'overdue', tone: 'bad', days: 3 });
    expect(dueLine(invoice({ status: 'overdue', dueAt: NOW }), NOW)).toMatchObject({ kind: 'overdue', days: 1 });
  });
  it('says when it was paid', () => {
    expect(dueLine(invoice({ status: 'paid', paidAt: NOW - DAY }), NOW)).toEqual({ kind: 'paid', tone: 'ok', at: NOW - DAY });
  });
});

describe('statement', () => {
  const paid = (id: string, paidAt: number, amount = 10) => invoice({ id, status: 'paid', paidAt, amount });
  it('groups paid invoices by month, latest first, and totals them', () => {
    const groups = groupByMonth([
      paid('a', new Date(2026, 2, 3).getTime()),
      paid('b', new Date(2026, 7, 27).getTime(), 20),
      paid('c', new Date(2026, 7, 2).getTime(), 5),
      invoice({ id: 'open' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-08', '2026-03']);
    expect(groups[0]?.invoices.map((i) => i.id)).toEqual(['b', 'c']);
    expect(groups[0]?.total).toBe(25);
  });
  it('lists outstanding invoices soonest first', () => {
    const list = outstanding([invoice({ id: 'late', dueAt: NOW + 9 * DAY }), invoice({ id: 'soon', dueAt: NOW + DAY }), paid('p', NOW)]);
    expect(list.map((i) => i.id)).toEqual(['soon', 'late']);
  });
  it('names the receipt after the invoice, with the one rule the state files it under', () => {
    expect(receiptRefFor(invoice({}).ref)).toBe('RCP-2026-0051');
  });
});
