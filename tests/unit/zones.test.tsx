import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangProvider } from '@/app/i18n';
import { getZone, solutions, zones } from '@/data/catalog';
import { ZoneRow } from '@/features/zones/ZoneRow';
import { ZoneTile } from '@/features/zones/ZoneTile';
import { allocatedPct, annualEstimate, applyTarget, FILTERS, isValidArea, isZoneFilter, takenPct, zonePrice, zonesFor } from '@/features/zones/model';
import { strings } from '@/features/zones/strings';

/** Formatted figures keep non-breaking spaces and bidi isolates; compare their words. */
const plain = (html: string) => html.replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2066-\u2069]/g, '');

const zone = (code: string) => {
  const found = getZone(code);
  if (!found) throw new Error(`no zone ${code}`);
  return found;
};

describe('zones explorer: filtering', () => {
  it('shows all 13 zones for "all" and only the zones offering a solution otherwise', () => {
    expect(zonesFor('all')).toHaveLength(13);
    expect(zonesFor('logistics').map((z) => z.code)).toEqual(['BA', 'AW', 'JS', 'AS']);
    expect(zonesFor('openYard').map((z) => z.code)).toEqual(['AK', 'KH']);
    expect(zonesFor('warehousing').every((z) => z.kind === 'warehousing')).toBe(true);
  });

  it('agrees with the zones each solution lists', () => {
    for (const solution of solutions) {
      expect(
        zonesFor(solution.key)
          .map((z) => z.code)
          .sort(),
      ).toEqual([...solution.zoneCodes].sort());
    }
  });

  it('recognises only its own filter keys', () => {
    expect(FILTERS).toHaveLength(6);
    expect(isZoneFilter('industrial')).toBe(true);
    expect(isZoneFilter('nope')).toBe(false);
    expect(isZoneFilter(undefined)).toBe(false);
  });
});

describe('zones explorer: figures', () => {
  it('computes the allocated share of land zones and the occupancy of parks', () => {
    expect(allocatedPct(zone('BA'))).toBe(58);
    expect(allocatedPct(zone('WK'))).toBeNull();
    expect(takenPct(zone('WK'))).toBe(95);
    expect(takenPct(zone('KH'))).toBe(94);
  });

  it('quotes the lowest published price, marked "from" when the zone offers dearer solutions', () => {
    expect(zonePrice(zone('JS'))).toEqual({ amount: 15, from: false });
    expect(zonePrice(zone('BA'))).toEqual({ amount: 15, from: true });
    expect(zonePrice(zone('AK'))).toEqual({ amount: 5, from: true });
    expect(zonePrice(zone('MIZ'))).toEqual({ amount: 5, from: false });
    expect(zonePrice(zone('US1'))).toEqual({ amount: null, from: false });
  });

  it('estimates the yearly rent as area × published price, and none for operator prices or bad areas', () => {
    expect(annualEstimate(5_000, 'logistics')).toBe(75_000);
    expect(annualEstimate(10_000, 'commercial')).toBe(500_000);
    expect(annualEstimate(5_000, 'warehousing')).toBeNull();
    expect(annualEstimate(null, 'logistics')).toBeNull();
    expect(annualEstimate(50, 'logistics')).toBeNull();
    expect(isValidArea(1_000_001)).toBe(false);
    expect(isValidArea(100)).toBe(true);
  });

  it('sends investors to the land application and guests to the welcome', () => {
    expect(applyTarget('BA', 'BA-117', false)).toBe('/start/A4?zone=BA&plot=BA-117');
    expect(applyTarget('BA', 'BA-117', true)).toBe('/welcome');
  });
});

describe('ZoneRow', () => {
  const render = (code: string, lang: 'ar' | 'en') =>
    plain(
      renderToStaticMarkup(
        <LangProvider lang={lang}>
          <ZoneRow zone={zone(code)} />
        </LangProvider>,
      ),
    );

  it('shows type, area and the allocated share of a land zone', () => {
    const html = render('BA', 'ar');
    expect(html).toContain('مجمّع بركة العوامر اللوجستي');
    expect(html).toContain('9.7 مليون م²');
    expect(html).toContain('مخصَّص');
    expect(html).toContain('#/zones/BA');
  });

  it('shows the operator and occupancy of a park', () => {
    const html = render('BF', 'en');
    expect(html).toContain('Al Asmakh Real Estate');
    expect(html).toMatch(/60%\S* occupied/);
  });
});

describe('ZoneTile', () => {
  const render = (code: string, lang: 'ar' | 'en') =>
    plain(
      renderToStaticMarkup(
        <LangProvider lang={lang}>
          <ul>
            <ZoneTile zone={zone(code)} />
          </ul>
        </LangProvider>,
      ),
    );

  it('links a land zone card to its page with its facts and published price', () => {
    const html = render('BA', 'en');
    expect(html).toContain('#/zones/BA');
    expect(html).toContain('Birkat Al Awamer Logistics Park');
    expect(html).toContain('58%');
    expect(html).toContain('From QAR 15 / m² / year');
  });

  it('quotes the operator price for a park', () => {
    expect(render('WK', 'ar')).toContain('حسب المشغّل');
  });
});

describe('zones copy', () => {
  it('has both languages, no em dash and no banned words', () => {
    for (const [key, value] of Object.entries(strings)) {
      expect(value.ar, key).toBeTruthy();
      expect(value.en, key).toBeTruthy();
      expect(`${value.ar} ${value.en}`, key).not.toMatch(/—|!|SLA|عميل|مستخدم|customer|\buser\b/i);
    }
  });

  it('writes «مناطق ون» in guillemets inside running Arabic', () => {
    expect(strings.fac_portal.ar).toContain('«مناطق ون»');
  });

  it('covers every zone in the catalogue', () => {
    expect(zones).toHaveLength(13);
  });
});
