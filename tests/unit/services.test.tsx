import { describe, expect, it } from 'vitest';
import { services } from '@/data/catalog';
import { filterServices, followOf, groupServices, makeServiceSearch, matchesReference, renderOfDomain, serviceSearch, startTarget } from '@/features/services/catalogue';

describe('services catalogue', () => {
  it('groups all fifty services by station, the current one first', () => {
    const groups = groupServices('build');
    expect(groups.map((g) => g.domain.code)).toEqual(['C', 'A', 'B', 'D', 'E', 'F', 'G']);
    expect(groups[0]?.stationNumber).toBe(3);
    expect(groups.find((g) => g.domain.code === 'E')?.stationNumber).toBeNull();
    expect(groups.reduce((n, g) => n + g.services.length, 0)).toBe(services.length);
  });

  it('keeps only the visible services and drops empty groups', () => {
    const groups = groupServices('join', services.filter((s) => s.domain === 'D'));
    expect(groups.map((g) => g.domain.code)).toEqual(['D']);
  });

  it('filters by whether the investor can start a service', () => {
    const startable = filterServices(services, 'startable');
    const automatic = filterServices(services, 'automatic');
    expect(startable.length + automatic.length).toBe(services.length);
    expect(startable.every((s) => s.startable)).toBe(true);
    expect(automatic.some((s) => s.startable)).toBe(false);
  });

  it('finds the common intents in Arabic and English', () => {
    const first = (q: string) => serviceSearch().search(q)[0]?.id;
    expect(first('تصريح دخول')).toBe('D2');
    expect(first('تجديد العقد')).toBe('B3');
    expect(first('رخصة البناء')).toBe('C2');
    expect(first('Gate pass')).toBe('D2');
    expect(first('A4')).toBe('A4');
    // No service has every word: the forgiving pass still finds the invoices.
    expect(serviceSearch().search('ادفع فاتورة').map((s) => s.id)).toContain('B1');
    expect(makeServiceSearch().search('zzzz qqqq')).toEqual([]);
  });

  it('matches request references loosely', () => {
    expect(matchesReference('MQ-2611-0042', '2611-0042')).toBe(true);
    expect(matchesReference('MQ-2611-0042', 'mq 2611')).toBe(true);
    expect(matchesReference('MQ-2611-0042', 'mq')).toBe(false);
    expect(matchesReference('MQ-2611-0042', '9999')).toBe(false);
  });

  it('sends start to the right place', () => {
    expect(startTarget('D1', 'tenant')).toBe('/start/D1');
    expect(startTarget('D1', 'guest')).toBe('/welcome');
    expect(startTarget('A2', 'guest')).toBe('/eligibility');
    expect(startTarget('A2', 'tenant')).toBe('/eligibility');
  });

  it('knows where automatic services are followed and which render stands for a domain', () => {
    expect(followOf('B1')).toBe('payments');
    expect(followOf('G5')).toBe('wallet');
    expect(followOf('F2')).toBeUndefined();
    expect(renderOfDomain('C')).toBe('construction');
    expect(renderOfDomain('G')).toBe('gate');
  });
});
