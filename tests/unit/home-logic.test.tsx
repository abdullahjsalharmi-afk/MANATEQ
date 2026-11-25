import { describe, expect, it } from 'vitest';
import { greetingOf, invoiceOfStep, itemRoute, SOLUTION_RENDER, STATION_RENDER, suggestedService } from '@/features/home/logic';
import { strings as homeStrings } from '@/features/home/strings';
import { groupByDay, startOfDay } from '@/features/notifications/group';
import { strings as noteStrings } from '@/features/notifications/strings';

describe('home logic', () => {
  it('greets by the hour', () => {
    expect(greetingOf(7)).toBe('morning');
    expect(greetingOf(11)).toBe('morning');
    expect(greetingOf(12)).toBe('afternoon');
    expect(greetingOf(17)).toBe('afternoon');
    expect(greetingOf(19)).toBe('evening');
    expect(greetingOf(2)).toBe('evening');
  });

  it('maps stations and solutions to their renders', () => {
    expect(STATION_RENDER).toEqual({ join: 'zone', contract: 'plot', build: 'construction', operate: 'warehouse' });
    expect(SOLUTION_RENDER.industrial).toBe('factory');
    expect(SOLUTION_RENDER.warehousing).toBe('units');
  });

  it('sends a journey item to its request, its start or its page', () => {
    expect(itemRoute({ serviceId: 'C2', state: 'current', requestId: 'r95', canStart: false })).toBe('/requests/r95');
    expect(itemRoute({ serviceId: 'A4', state: 'current', canStart: true })).toBe('/start/A4');
    expect(itemRoute({ serviceId: 'C8', state: 'upcoming', canStart: false })).toBe('/services/C8');
  });

  it('reads the invoice and the suggested service out of a next step', () => {
    expect(invoiceOfStep({ id: 'invoice:inv51', kind: 'invoice' })).toBe('inv51');
    expect(invoiceOfStep({ id: 'request:r85', kind: 'renewal' })).toBeNull();
    expect(suggestedService({ id: 'start:A4', kind: 'start_service' })).toBe('A4');
    expect(suggestedService({ id: 'start:C2:p1', kind: 'start_service' })).toBe('C2');
    expect(suggestedService({ id: 'draft:A4', kind: 'start_service' })).toBeNull();
  });
});

describe('notifications grouping', () => {
  it('splits today from earlier by the local day', () => {
    const now = new Date(2026, 10, 25, 15, 0).getTime();
    const items = [{ at: now - 60_000 }, { at: startOfDay(now) }, { at: startOfDay(now) - 1 }, { at: now - 3 * 86_400_000 }];
    const { today, earlier } = groupByDay(items, now);
    expect(today).toHaveLength(2);
    expect(earlier).toHaveLength(2);
  });
});

describe('copy', () => {
  const all = [...Object.values(homeStrings), ...Object.values(noteStrings)];
  it('has no em dash, exclamation mark or forbidden words in either language', () => {
    for (const entry of all) {
      for (const text of [entry.ar, entry.en]) {
        expect(text).not.toMatch(/[—!]/);
        expect(text).not.toMatch(/\b(user|customer|SLA|ticket)\b/i);
        expect(text).not.toMatch(/العميل|المستخدم/);
      }
    }
  });
});
