import { describe, expect, it } from 'vitest';
import { getService } from '@/data/catalog';
import type { Lease, Plot } from '@/domain/types';
import { seedWorld } from '@/state';
import {
  ENDING_SOON_DAYS,
  invoicesOfLease,
  leaseEndingSoon,
  openRenewal,
  orderTeam,
  plotRender,
  plotServiceIds,
  plotStatusMeta,
  startRoute,
} from '@/features/account/account-model';
import { strings } from '@/features/account/strings';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 25, 9);

const lease = (endsAt: number): Lease => ({ id: 'l', ref: 'L-1', plotId: 'p', startsAt: NOW - 300 * DAY, endsAt, ratePerSqmYear: 10, annualRent: 50_000, status: 'active' });
const plot = (status: Plot['status']): Plot => ({ id: 'BA-121', number: 'BA-121', zoneCode: 'BA', areaSqm: 10_000, solution: 'logistics', status });

describe('account model', () => {
  it('gives every plot status a word key and an icon', () => {
    for (const status of ['reserved', 'leased', 'handed_over', 'building', 'operating'] as const) {
      const meta = plotStatusMeta(status);
      expect(strings[meta.key].ar.length).toBeGreaterThan(0);
      expect(strings[meta.key].en.length).toBeGreaterThan(0);
      expect(meta.icon).toBeTruthy();
    }
  });

  it('counts a lease as ending soon only inside the renewal window and before it ends', () => {
    expect(leaseEndingSoon(undefined, NOW)).toBe(false);
    expect(leaseEndingSoon(lease(NOW + 100 * DAY), NOW)).toBe(true);
    expect(leaseEndingSoon(lease(NOW + (ENDING_SOON_DAYS + 1) * DAY), NOW)).toBe(false);
    expect(leaseEndingSoon(lease(NOW - DAY), NOW)).toBe(false);
  });

  it('offers startable services that fit the plot status', () => {
    expect(plotServiceIds(plot('operating'))).toEqual(['D1', 'D2', 'C9', 'B5']);
    expect(plotServiceIds(plot('building'))).toEqual(['C1', 'C6', 'C5']);
    expect(plotServiceIds(plot('reserved'))).toEqual([]);
    for (const status of ['leased', 'handed_over', 'building', 'operating'] as const) {
      for (const id of plotServiceIds(plot(status))) expect(getService(id)?.startable).toBe(true);
    }
    expect(startRoute('D1', 'BA-121')).toBe('/start/D1?plot=BA-121');
  });

  it('reads the tenant world: renewal, invoices, team order', () => {
    const now = Date.now();
    const world = seedWorld('tenant', now);
    const yard = world.plots.find((candidate) => candidate.id === 'AK-113');
    expect(yard).toBeDefined();
    const yardLease = world.leases.find((candidate) => candidate.id === yard?.leaseId);
    expect(leaseEndingSoon(yardLease, now)).toBe(true);
    const renewal = { ...world.requests[0]!, id: 'r-b3', serviceId: 'B3', plotId: 'AK-113', status: 'needs_you' as const };
    expect(openRenewal([...world.requests, renewal], 'AK-113')?.id).toBe('r-b3');
    expect(openRenewal([{ ...renewal, status: 'done' }], 'AK-113')).toBeUndefined();
    expect(openRenewal([renewal], 'BA-121')).toBeUndefined();

    const ba = world.plots.find((candidate) => candidate.id === 'BA-121');
    const invoices = invoicesOfLease(world.invoices, ba?.leaseId);
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices.length).toBeLessThanOrEqual(3);
    expect(invoices.every((invoice) => invoice.leaseId === ba?.leaseId)).toBe(true);
    expect(invoicesOfLease(world.invoices, undefined)).toEqual([]);

    const team = orderTeam([...world.team].reverse());
    expect(team[0]?.scope).toBe('owner');
    expect(team).toHaveLength(world.team.length);
  });
});

describe('plot renders', () => {
  it('show bare land, the site, then the solution', () => {
    expect(plotRender(plot('leased'))).toBe('plot');
    expect(plotRender(plot('building'))).toBe('construction');
    expect(plotRender(plot('operating'))).toBe('warehouse');
    expect(plotRender({ ...plot('operating'), solution: 'openYard' })).toBe('yard');
  });
});

describe('account strings', () => {
  it('are bilingual, with no em dashes, no exclamation marks and no forbidden words', () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.ar, key).not.toBe('');
      expect(value.en, key).not.toBe('');
      for (const text of [value.ar, value.en]) {
        expect(text, key).not.toMatch(/—|!/);
        expect(text, key).not.toMatch(/\b(user|customer|client|SLA|ticket)\b|العميل|المستخدم/i);
      }
    }
  });
});
