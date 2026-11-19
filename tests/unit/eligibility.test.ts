import { describe, expect, it, vi } from 'vitest';
import source from '../../data/source/activities.json';
import { activities, getActivity, getService, getSolution, getZone, solutions, zones } from '@/data/catalog';
import type { Activity, L10n, SolutionKey } from '@/data/types';
import {
  checkEligibility,
  estimateAnnualRent,
  searchActivities,
  toEligibilityResult,
  UNLISTED_ACTIVITY,
  type Availability,
  type EligibilityInput,
  type EligibilityOutcome,
} from '@/domain/eligibility';
import { plotsFor } from '@/domain/plots';

const FOOD = 'ACT-101';
const BEVERAGES = 'ACT-102';
const PLASTICS = 'ACT-201';
const PHARMA = 'ACT-204';
const METAL = 'ACT-301';
const PRINTING = 'ACT-402';
const DRY_WAREHOUSING = 'ACT-501';
const CONTAINERS = 'ACT-505';
const AUTO_PARTS = 'ACT-602';
const SHOWROOMS = 'ACT-701';
const RETAIL_MALL = 'ACT-703';
const FUEL_STORAGE = 'ACT-802';
const RESIDENTIAL = 'ACT-901';
const LABOUR_ACCOMMODATION = 'ACT-902';

const SOLUTION_KEYS: SolutionKey[] = ['logistics', 'industrial', 'commercial', 'openYard', 'warehousing'];
const LOGISTICS_PARKS = ['BA', 'AW', 'JS', 'AS'];
const WAREHOUSING_PARKS = ['WK', 'BS', 'BF', 'US1', 'US2'];

const zonesOf = (options: { zone: { code: string } }[]): string[] => options.map((option) => option.zone.code);
const pairsOf = (options: { zone: { code: string }; solution: SolutionKey }[]): string[] => options.map((option) => `${option.zone.code}/${option.solution}`);

/** A land register with a fixed number of free plots per zone, whatever the size. */
const register = (counts: Record<string, number>): Availability => (zoneCode) => counts[zoneCode] ?? 0;

function isBilingual(text: L10n | null | undefined): boolean {
  return !!text && text.ar.trim() !== '' && text.en.trim() !== '' && !/[{}]/.test(text.ar + text.en);
}

describe('the illustrative activity list', () => {
  const targeted = activities.filter((a) => a.verdict === 'targeted');

  it('is labelled illustrative, record by record', () => {
    for (const record of source as { code: string; illustrative?: unknown }[]) expect(record.illustrative, record.code).toBe(true);
    for (const activity of activities as (Activity & { illustrative?: unknown })[]) expect(activity.illustrative, activity.code).toBe(true);
  });

  it('is the list the app reads (the data build has been run)', () => {
    expect(activities.map((a) => a.code)).toEqual(source.map((a) => a.code));
  });

  it('has about thirty activities with unique codes', () => {
    expect(activities.length).toBeGreaterThanOrEqual(28);
    expect(activities.length).toBeLessThanOrEqual(34);
    expect(new Set(activities.map((a) => a.code)).size).toBe(activities.length);
    for (const activity of activities) expect(activity.code).toMatch(/^ACT-\d{3}$/);
    expect(getActivity(UNLISTED_ACTIVITY)).toBeUndefined();
  });

  it('is bilingual, with Western digits and one plain sentence per reason', () => {
    for (const activity of activities) {
      for (const text of [activity.name, activity.sector, activity.reason]) {
        expect(isBilingual(text), activity.code).toBe(true);
        expect(text?.ar, activity.code).toMatch(/[ء-ي]/);
        expect(text?.ar, activity.code).not.toMatch(/[A-Za-z٠-٩۰-۹]/);
        expect(text?.en, activity.code).not.toMatch(/[؀-ۿ]/);
      }
      expect(activity.name.en, activity.code).not.toMatch(/\.$/);
      for (const sentence of [activity.reason?.ar ?? '', activity.reason?.en ?? '']) {
        expect(sentence, activity.code).toMatch(/\.$/);
        expect(sentence.slice(0, -1), activity.code).not.toMatch(/[.!?؟]\s/);
      }
    }
  });

  it('names each sector the same way everywhere', () => {
    const english = new Map<string, string>();
    for (const { sector } of activities) {
      expect(english.get(sector.ar) ?? sector.en).toBe(sector.en);
      english.set(sector.ar, sector.en);
    }
    expect(new Set(english.values()).size).toBe(english.size);
    expect(english.size).toBeLessThanOrEqual(10);
  });

  it('names only solutions and zones that exist and go together', () => {
    for (const activity of activities) {
      for (const key of activity.solutions) expect(getSolution(key), `${activity.code}: ${key}`).toBeDefined();
      for (const code of activity.zones) {
        const zone = getZone(code);
        expect(zone, `${activity.code}: ${code}`).toBeDefined();
        expect(zone?.solutions.some((key) => activity.solutions.includes(key)), `${activity.code}: no solution of the activity is offered in ${code}`).toBe(true);
      }
      expect(new Set(activity.zones).size, activity.code).toBe(activity.zones.length);
      expect(new Set(activity.solutions).size, activity.code).toBe(activity.solutions.length);
    }
    for (const activity of targeted) {
      expect(activity.solutions.length, activity.code).toBeGreaterThan(0);
      for (const key of activity.solutions) {
        expect(activity.zones.some((code) => getZone(code)?.solutions.includes(key)), `${activity.code}: ${key} is offered in none of its zones`).toBe(true);
      }
    }
  });

  it('covers the three verdicts, with the three non-targeted examples', () => {
    expect(targeted.length).toBeGreaterThan(20);
    expect(activities.filter((a) => a.verdict === 'review').map((a) => a.code)).toEqual([PHARMA, 'ACT-801', FUEL_STORAGE]);
    const nonTargeted = activities.filter((a) => a.verdict === 'not_targeted');
    expect(nonTargeted.map((a) => a.code)).toEqual([RETAIL_MALL, RESIDENTIAL, LABOUR_ACCOMMODATION]);
    for (const activity of nonTargeted) {
      expect(activity.zones).toEqual([]);
      expect(activity.solutions).toEqual([]);
    }
  });

  it('follows the Guide: where each kind of activity is targeted', () => {
    const zonesFor = (code: string, key: SolutionKey) => (getActivity(code) as Activity).zones.filter((zone) => getZone(zone)?.solutions.includes(key));
    expect(zonesFor(PLASTICS, 'industrial')).toEqual(['MIZ']); // heavy industry at Mesaieed
    expect(zonesFor(PRINTING, 'industrial')).toEqual(['SMI']); // light manufacturing in the SMI Zone
    expect(zonesFor(DRY_WAREHOUSING, 'logistics')).toEqual(LOGISTICS_PARKS); // warehousing in the logistics parks
    expect(zonesFor('ACT-601', 'logistics')).toEqual(LOGISTICS_PARKS); // workshops in the logistics parks
    expect(zonesFor(CONTAINERS, 'openYard')).toEqual(['KH', 'AK']); // open yards at Al Khor and Al Karaana
    expect(zonesFor(SHOWROOMS, 'commercial')).toEqual(['AS', 'AW', 'BA']); // commercial at Aba Saleel, Al Wakra, Birkat Al Awamer
    expect(zonesFor(DRY_WAREHOUSING, 'warehousing')).toEqual(WAREHOUSING_PARKS); // ready-built warehouses in the five parks
  });

  it('keeps high-hazard activities out of the lighter-industry zones', () => {
    const high = targeted.filter((a) => a.hazard === 'high');
    expect(high.length).toBeGreaterThan(0);
    for (const activity of high) expect(activity.zones, activity.code).toEqual(['MIZ']);
    expect(getActivity(FUEL_STORAGE)?.hazard).toBe('high');
  });
});

describe('the rent estimate', () => {
  it('is the area times the published price', () => {
    expect(estimateAnnualRent('industrial', 20_000)).toBe(100_000);
    expect(estimateAnnualRent('logistics', 8_000)).toBe(120_000);
    expect(estimateAnnualRent('commercial', 1_000)).toBe(50_000);
    expect(estimateAnnualRent('openYard', 3_000)).toBe(30_000);
    for (const solution of solutions) {
      const price = solution.price.qarPerSqmYear;
      if (price !== null) expect(estimateAnnualRent(solution.key, 2_500)).toBe(2_500 * price);
    }
  });

  it('does not exist for warehousing: the operators set the price', () => {
    expect(getSolution('warehousing')?.price.qarPerSqmYear).toBeNull();
    expect(estimateAnnualRent('warehousing', 1_200)).toBeNull();
  });

  it('needs a real area and rounds to whole riyals', () => {
    expect(estimateAnnualRent('industrial', 0)).toBeNull();
    expect(estimateAnnualRent('industrial', -500)).toBeNull();
    expect(estimateAnnualRent('industrial', Number.NaN)).toBeNull();
    expect(estimateAnnualRent('industrial', Number.POSITIVE_INFINITY)).toBeNull();
    expect(estimateAnnualRent('industrial', 1_234.5)).toBe(6_173);
  });
});

describe('a targeted activity', () => {
  it('lands the Guide’s plastics example on Mesaieed', () => {
    const outcome = checkEligibility({ activityCode: PLASTICS, solution: 'industrial', areaSqm: 20_000 }, register({ MIZ: 3, SMI: 9 }));
    expect(outcome.verdict).toBe('targeted');
    expect(outcome.eligible).toBe(true);
    expect(outcome.obstacle).toBeNull();
    expect(outcome.matches).toHaveLength(1);
    expect(outcome.matches[0]).toMatchObject({ zone: getZone('MIZ'), solution: 'industrial', annualRent: 100_000, plotHint: 3, fit: 'targeted' });
    // "…flags that the activity's hazard class rules out the lighter-industry zones"
    expect(outcome.reason.en).toContain('hazard class rules out the lighter-industry zones');
    expect(outcome.reason.ar).toContain('تستبعد مناطق الصناعات الخفيفة');
    expect(outcome.alternatives).toEqual([]);
    expect(outcome.next).toBe('A4');
  });

  it('answers for every zone that fits when no zone is requested', () => {
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'logistics', areaSqm: 5_000 });
    expect(outcome.eligible).toBe(true);
    expect(zonesOf(outcome.matches)).toEqual(['AW', 'BA', 'JS', 'AS']);
    for (const match of outcome.matches) expect(match).toMatchObject({ solution: 'logistics', annualRent: 75_000, plotHint: null, fit: 'targeted' });
    expect(outcome.reason).toEqual(getActivity(FOOD)?.reason);
  });

  it('answers for the requested zone alone', () => {
    // The Guide's enquiry example: a food-processing company near Hamad Port is pointed to Al Wakra Logistics Park.
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'logistics', areaSqm: 5_000, zoneCode: 'AW' });
    expect(outcome.eligible).toBe(true);
    expect(zonesOf(outcome.matches)).toEqual(['AW']);
    expect(outcome.alternatives).toEqual([]);
    expect(outcome.next).toBe('A4');
  });

  it('keeps the solutions of one activity apart', () => {
    const factory = checkEligibility({ activityCode: FOOD, solution: 'industrial', areaSqm: 5_000 });
    expect(pairsOf(factory.matches)).toEqual(['SMI/industrial']);
    expect(factory.matches[0]?.annualRent).toBe(25_000);
    const showroom = checkEligibility({ activityCode: AUTO_PARTS, solution: 'commercial', areaSqm: 1_000 });
    expect(pairsOf(showroom.matches)).toEqual(['BA/commercial', 'AW/commercial', 'AS/commercial']);
  });

  it('ignores a zone code that does not exist', () => {
    const input: EligibilityInput = { activityCode: FOOD, solution: 'logistics', areaSqm: 5_000 };
    expect(checkEligibility({ ...input, zoneCode: 'NOWHERE' })).toEqual(checkEligibility(input));
  });

  it('still answers on targeting when the area is not known yet', () => {
    const count = vi.fn(() => 4);
    const outcome = checkEligibility({ activityCode: PLASTICS, solution: 'industrial', areaSqm: 0 }, count);
    expect(outcome.eligible).toBe(true);
    expect(outcome.matches[0]).toMatchObject({ annualRent: null, plotHint: null });
    expect(count).not.toHaveBeenCalled();
  });
});

describe('a first choice that does not fit', () => {
  it('names the hazard class and offers the zone that takes it', () => {
    const outcome = checkEligibility({ activityCode: PLASTICS, solution: 'industrial', areaSqm: 20_000, zoneCode: 'SMI' });
    expect(outcome.verdict).toBe('targeted');
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBe('hazard');
    expect(outcome.matches).toEqual([]);
    expect(outcome.reason.en).toBe('The hazard class of the activity rules out the lighter-industry zones, including the Small and Medium Industries Zone.');
    expect(outcome.reason.ar).toBe('فئة خطورة النشاط تستبعد مناطق الصناعات الخفيفة، ومنها منطقة الصناعات الصغيرة والمتوسطة.');
    expect(pairsOf(outcome.alternatives)).toEqual(['MIZ/industrial']);
    expect(outcome.alternatives[0]).toMatchObject({ annualRent: 100_000, plotHint: null });
    expect(outcome.alternatives[0]?.why.en).toBe('The activity is targeted in Mesaieed Industrial Zone.');
    expect(outcome.alternatives[0]?.why.ar).toBe('النشاط مستهدف في منطقة مسيعيد الصناعية.');
    expect(outcome.next).toBeNull();
  });

  it('keeps the zone when another solution fits there, then offers the same solution elsewhere', () => {
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'industrial', areaSqm: 5_000, zoneCode: 'AW' });
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBe('solution');
    expect(outcome.reason.en).toBe('Industrial solutions are not offered in Al Wakra Logistics Park.');
    expect(outcome.reason.ar).toBe('لا تتوفر الحلول الصناعية في مجمّع الوكرة اللوجستي.');
    expect(pairsOf(outcome.alternatives)).toEqual(['AW/logistics', 'SMI/industrial']);
    expect(outcome.alternatives.map((alternative) => alternative.annualRent)).toEqual([75_000, 25_000]);
    expect(outcome.alternatives[0]?.why.en).toBe('Logistics solutions cover this activity in Al Wakra Logistics Park.');
    expect(outcome.alternatives[0]?.why.ar).toBe('تشمل الحلول اللوجستية هذا النشاط في مجمّع الوكرة اللوجستي.');
  });

  it('says when the solution does not cover the activity', () => {
    const outcome = checkEligibility({ activityCode: SHOWROOMS, solution: 'logistics', areaSqm: 1_000, zoneCode: 'BA' });
    expect(outcome.obstacle).toBe('solution');
    expect(outcome.reason.en).toBe('Logistics solutions do not cover this activity.');
    expect(outcome.reason.ar).toBe('الحلول اللوجستية لا تشمل هذا النشاط.');
    // Commercial plots exist in the same zone, so nothing further away is offered.
    expect(pairsOf(outcome.alternatives)).toEqual(['BA/commercial']);
  });

  it('says when the activity is not targeted in the zone', () => {
    const outcome = checkEligibility({ activityCode: BEVERAGES, solution: 'industrial', areaSqm: 4_000, zoneCode: 'AK' });
    expect(outcome.obstacle).toBe('zone');
    expect(outcome.reason.en).toBe('This activity is not targeted in Al Karaana Industrial Zone.');
    expect(outcome.reason.ar).toBe('هذا النشاط غير مستهدف في منطقة الكرعانة الصناعية.');
    expect(pairsOf(outcome.alternatives)).toEqual(['SMI/industrial']);
  });

  it('offers the solutions that cover the activity when the chosen one covers it nowhere', () => {
    const outcome = checkEligibility({ activityCode: SHOWROOMS, solution: 'industrial', areaSqm: 1_000 });
    expect(outcome.verdict).toBe('targeted');
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBe('solution');
    expect(outcome.matches).toEqual([]);
    expect(pairsOf(outcome.alternatives)).toEqual(['AS/commercial', 'AW/commercial', 'BA/commercial']);
    expect(outcome.alternatives[0]?.annualRent).toBe(50_000);
  });

  it('sends open yards to Al Khor and Al Karaana', () => {
    const outcome = checkEligibility({ activityCode: CONTAINERS, solution: 'openYard', areaSqm: 3_000, zoneCode: 'BA' });
    expect(outcome.obstacle).toBe('solution');
    expect(outcome.reason.en).toBe('Open yards are not offered in Birkat Al Awamer Logistics Park.');
    expect(pairsOf(outcome.alternatives)).toEqual(['KH/openYard', 'AK/openYard']);
    expect(outcome.alternatives[0]?.annualRent).toBe(30_000);
  });

  it('offers a workshop its logistics park when industrial land was asked for there', () => {
    const outcome = checkEligibility({ activityCode: METAL, solution: 'industrial', areaSqm: 2_000, zoneCode: 'AS' });
    expect(pairsOf(outcome.alternatives)).toEqual(['AS/logistics', 'SMI/industrial', 'MIZ/industrial']);
  });
});

describe('availability', () => {
  const food: EligibilityInput = { activityCode: FOOD, solution: 'logistics', areaSqm: 5_000 };
  const some = register({ AW: 0, BA: 2, JS: 0, AS: 1 });

  it('asks the land register for plots of at least the requested area, zone by zone', () => {
    const count = vi.fn<Availability>((zoneCode) => (zoneCode === 'BA' ? 2 : 1));
    const outcome = checkEligibility(food, count);
    expect(count.mock.calls).toEqual([['AW', 5_000], ['BA', 5_000], ['JS', 5_000], ['AS', 5_000]]);
    expect(outcome.matches.map((match) => match.plotHint)).toEqual([1, 2, 1, 1]);
  });

  it('puts the zones with a free plot of that size first', () => {
    const outcome = checkEligibility(food, some);
    expect(outcome.eligible).toBe(true);
    expect(zonesOf(outcome.matches)).toEqual(['BA', 'AS', 'AW', 'JS']);
    expect(outcome.matches.map((match) => match.plotHint)).toEqual([2, 1, 0, 0]);
  });

  it('is not eligible in a zone without a plot of that size, and points to the zones that have one', () => {
    const outcome = checkEligibility({ ...food, zoneCode: 'AW' }, some);
    expect(outcome.verdict).toBe('targeted');
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBe('plots');
    expect(outcome.matches).toHaveLength(1);
    expect(outcome.matches[0]).toMatchObject({ zone: getZone('AW'), plotHint: 0, annualRent: 75_000 });
    expect(outcome.reason.en).toBe('No plot of 5,000 m² or more is free in Al Wakra Logistics Park right now.');
    expect(outcome.reason.ar).toBe('لا تتوفر الآن في مجمّع الوكرة اللوجستي قطعة بمساحة 5,000 م² أو أكثر.');
    expect(pairsOf(outcome.alternatives)).toEqual(['BA/logistics', 'AS/logistics']);
    expect(outcome.alternatives.map((alternative) => alternative.plotHint)).toEqual([2, 1]);
    expect(outcome.alternatives[0]?.why.en).toBe('Plots of 5,000 m² or more are free in Birkat Al Awamer Logistics Park.');
    expect(outcome.alternatives[0]?.why.ar).toBe('تتوفر في مجمّع بركة العوامر اللوجستي قطع بمساحة 5,000 م² أو أكثر.');
    // The investor's next step is to be told when a plot is released.
    expect(outcome.next).toBe('E4');
  });

  it('says so when no targeted zone has a plot of that size', () => {
    const outcome = checkEligibility(food, register({}));
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBe('plots');
    expect(zonesOf(outcome.matches)).toEqual(['AW', 'BA', 'JS', 'AS']);
    expect(outcome.alternatives).toEqual([]);
    expect(outcome.reason.en).toBe('No plot of 5,000 m² or more is free right now in the zones that target this activity.');
    expect(outcome.next).toBe('E4');
  });

  it('shows plot counts on alternatives, zones with a free plot first', () => {
    const outcome = checkEligibility({ activityCode: BEVERAGES, solution: 'logistics', areaSqm: 5_000 }, register({ SMI: 6 }));
    expect(pairsOf(outcome.alternatives)).toEqual(['SMI/industrial']);
    expect(outcome.alternatives[0]?.plotHint).toBe(6);
    const yards = checkEligibility({ activityCode: CONTAINERS, solution: 'openYard', areaSqm: 3_000, zoneCode: 'BA' }, register({ AK: 5 }));
    expect(zonesOf(yards.alternatives)).toEqual(['AK', 'KH']);
    expect(yards.alternatives.map((alternative) => alternative.plotHint)).toEqual([5, 0]);
  });

  it('tidies what the land register returns', () => {
    const hint = (value: number) => checkEligibility({ ...food, zoneCode: 'BA' }, () => value).matches[0]?.plotHint;
    expect(hint(2.9)).toBe(2);
    expect(hint(-3)).toBe(0);
    expect(hint(Number.NaN)).toBeNull();
  });

  it('works with the illustrative plot layout', () => {
    const layout: Availability = (zoneCode, areaSqm) => plotsFor(zoneCode).filter((plot) => plot.status === 'available' && plot.areaSqm >= areaSqm).length;
    const outcome = checkEligibility({ ...food, areaSqm: 2_500 }, layout);
    expect(outcome.eligible).toBe(true);
    for (const match of outcome.matches) expect(match.plotHint).toBe(layout(match.zone.code, 2_500));
    expect(outcome.matches[0]?.plotHint).toBeGreaterThan(0);
  });
});

describe('ready-built warehousing', () => {
  it('is referred to the park operators (F1), with no rent estimate and no plot count', () => {
    const count = vi.fn(() => 7);
    const outcome = checkEligibility({ activityCode: DRY_WAREHOUSING, solution: 'warehousing', areaSqm: 1_200 }, count);
    expect(outcome.verdict).toBe('targeted');
    expect(outcome.eligible).toBe(true);
    expect(zonesOf(outcome.matches)).toEqual(WAREHOUSING_PARKS);
    for (const match of outcome.matches) expect(match).toMatchObject({ solution: 'warehousing', annualRent: null, plotHint: null });
    expect(count).not.toHaveBeenCalled();
    expect(isBilingual(outcome.note)).toBe(true);
    expect(outcome.note?.en).toContain('operators');
    expect(outcome.next).toBe('F1');
  });

  it('has no note for land', () => {
    expect(checkEligibility({ activityCode: DRY_WAREHOUSING, solution: 'logistics', areaSqm: 8_000 }).note).toBeNull();
  });

  it('is an alternative to land, and land an alternative to it', () => {
    const outcome = checkEligibility({ activityCode: DRY_WAREHOUSING, solution: 'warehousing', areaSqm: 1_200, zoneCode: 'BA' });
    expect(outcome.obstacle).toBe('solution');
    expect(pairsOf(outcome.alternatives)).toEqual(['BA/logistics', ...WAREHOUSING_PARKS.map((code) => `${code}/warehousing`)]);
    expect(outcome.alternatives.map((alternative) => alternative.annualRent)).toEqual([18_000, null, null, null, null, null]);
    expect(outcome.note).toBeNull();
  });

  it('does not take a factory', () => {
    const outcome = checkEligibility({ activityCode: PLASTICS, solution: 'warehousing', areaSqm: 20_000 });
    expect(outcome.eligible).toBe(false);
    expect(outcome.reason.en).toBe('Warehousing solutions do not cover this activity.');
    expect(pairsOf(outcome.alternatives)).toEqual(['MIZ/industrial']);
  });
});

describe('review and non-targeted activities', () => {
  const closed = (outcome: EligibilityOutcome) => {
    expect(outcome.eligible).toBe(false);
    expect(outcome.obstacle).toBeNull();
    expect(outcome.matches).toEqual([]);
    expect(outcome.alternatives).toEqual([]);
    expect(outcome.note).toBeNull();
    expect(outcome.next).toBeNull();
  };

  it('sends a borderline activity to a planning review instead of an instant answer', () => {
    for (const code of [PHARMA, 'ACT-801', FUEL_STORAGE]) {
      const outcome = checkEligibility({ activityCode: code, solution: 'industrial', areaSqm: 6_000, zoneCode: 'MIZ' }, register({ MIZ: 5 }));
      expect(outcome.verdict).toBe('review');
      expect(outcome.reason).toEqual(getActivity(code)?.reason);
      closed(outcome);
    }
  });

  it('sends an activity that is not on the list to a planning review', () => {
    for (const code of [UNLISTED_ACTIVITY, 'data centre', '']) {
      const outcome = checkEligibility({ activityCode: code, solution: 'logistics', areaSqm: 6_000 });
      expect(outcome.verdict).toBe('review');
      expect(outcome.reason.en).toContain('not on the list');
      expect(outcome.reason.ar).toContain('غير مدرج');
      closed(outcome);
    }
  });

  it('stops at a non-targeted activity, whatever else is asked', () => {
    for (const code of [RETAIL_MALL, RESIDENTIAL, LABOUR_ACCOMMODATION]) {
      const outcome = checkEligibility({ activityCode: code, solution: 'commercial', areaSqm: 10_000, zoneCode: 'BA' }, register({ BA: 12 }));
      expect(outcome.verdict).toBe('not_targeted');
      expect(outcome.reason).toEqual(getActivity(code)?.reason);
      closed(outcome);
    }
    // The published allowance, not a guess: accommodation up to 6% of a logistics plot.
    expect(getActivity(LABOUR_ACCOMMODATION)?.reason?.en).toContain('6%');
    expect(getSolution('logistics')?.notes.en).toContain('6% of plot area');
  });
});

describe('every activity, solution and zone', () => {
  const cases = activities.flatMap((activity) => SOLUTION_KEYS.flatMap((solution) => [undefined, ...zones.map((zone) => zone.code)].map((zoneCode) => ({ activity, solution, zoneCode }))));
  const inputOf = ({ activity, solution, zoneCode }: (typeof cases)[number], areaSqm = 4_000): EligibilityInput => ({ activityCode: activity.code, solution, areaSqm, ...(zoneCode ? { zoneCode } : {}) });

  it('gets a consistent, explained answer', () => {
    expect(cases).toHaveLength(activities.length * 5 * 14);
    for (const item of cases) {
      const { activity, solution, zoneCode } = item;
      const label = `${activity.code} · ${solution} · ${zoneCode ?? 'any zone'}`;
      const outcome = checkEligibility(inputOf(item));

      expect(outcome.verdict, label).toBe(activity.verdict);
      expect(isBilingual(outcome.reason), label).toBe(true);
      expect(outcome.eligible, label).toBe(outcome.matches.length > 0);
      expect(outcome.obstacle === null, label).toBe(outcome.eligible || outcome.verdict !== 'targeted');
      expect(outcome.next, label).toBe(outcome.eligible ? (solution === 'warehousing' ? 'F1' : 'A4') : null);
      expect(outcome.note !== null, label).toBe(outcome.eligible && solution === 'warehousing');
      if (outcome.verdict !== 'targeted') {
        expect(outcome.matches.length + outcome.alternatives.length, label).toBe(0);
        continue;
      }

      for (const match of outcome.matches) {
        expect(match.fit, label).toBe('targeted');
        expect(match.solution, label).toBe(solution);
        expect(match.zone.solutions, label).toContain(solution);
        expect(activity.solutions, label).toContain(solution);
        expect(activity.zones, label).toContain(match.zone.code);
        expect(match.annualRent, label).toBe(estimateAnnualRent(solution, 4_000));
        if (zoneCode) expect(match.zone.code, label).toBe(zoneCode);
      }

      // A targeted activity always fits somewhere: either as asked, or through an alternative — never both.
      expect(outcome.alternatives.length > 0, label).toBe(!outcome.eligible);
      expect(new Set(pairsOf(outcome.alternatives)).size, label).toBe(outcome.alternatives.length);
      for (const alternative of outcome.alternatives) {
        expect(isBilingual(alternative.why), label).toBe(true);
        expect(`${alternative.zone.code}/${alternative.solution}`, label).not.toBe(`${zoneCode}/${solution}`);
        const again = checkEligibility({ activityCode: activity.code, solution: alternative.solution, areaSqm: 4_000, zoneCode: alternative.zone.code });
        expect(again.eligible, `${label} → ${alternative.zone.code}/${alternative.solution}`).toBe(true);
        expect(zonesOf(again.matches), label).toEqual([alternative.zone.code]);
        expect(again.matches[0]?.annualRent, label).toBe(alternative.annualRent);
      }
    }
  });

  it('holds together when availability is known', () => {
    // A land register where every third zone has no plot of that size.
    const availability: Availability = (zoneCode) => (zones.findIndex((zone) => zone.code === zoneCode) % 3 === 0 ? 0 : 2);
    for (const item of cases) {
      const { activity, solution, zoneCode } = item;
      const label = `${activity.code} · ${solution} · ${zoneCode ?? 'any zone'}`;
      const outcome = checkEligibility(inputOf(item), availability);

      expect(outcome.eligible, label).toBe(outcome.matches.some((match) => match.plotHint !== 0));
      for (const option of [...outcome.matches, ...outcome.alternatives]) {
        expect(option.plotHint, label).toBe(option.zone.kind === 'land' ? availability(option.zone.code, 4_000) : null);
      }
      // Whatever is known about plots changes the order and the eligibility, never where the activity is targeted.
      expect([...zonesOf(outcome.matches)].sort(), label).toEqual([...zonesOf(checkEligibility(inputOf(item)).matches)].sort());
      if (outcome.obstacle === 'plots') {
        expect(outcome.next, label).toBe('E4');
        for (const alternative of outcome.alternatives) {
          expect(alternative.solution, label).toBe(solution);
          expect(alternative.plotHint, label).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('what comes next', () => {
  it('points to services the investor can start', () => {
    for (const id of ['A4', 'E4', 'F1']) expect(getService(id)?.startable, id).toBe(true);
  });

  it('keeps a compact record for the profile and the land application', () => {
    const input: EligibilityInput = { activityCode: AUTO_PARTS, solution: 'logistics', areaSqm: 8_000, zoneCode: 'BA' };
    expect(toEligibilityResult(input, checkEligibility(input), 1_795_000_000_000)).toEqual({
      at: 1_795_000_000_000,
      activityCode: AUTO_PARTS,
      solution: 'logistics',
      areaSqm: 8_000,
      verdict: 'targeted',
      zoneCodes: ['BA'],
    });
    const anywhere: EligibilityInput = { activityCode: AUTO_PARTS, solution: 'logistics', areaSqm: 8_000 };
    expect(toEligibilityResult(anywhere, checkEligibility(anywhere), 0).zoneCodes).toEqual(LOGISTICS_PARKS);
    const review: EligibilityInput = { activityCode: PHARMA, solution: 'industrial', areaSqm: 8_000 };
    expect(toEligibilityResult(review, checkEligibility(review), 0)).toMatchObject({ verdict: 'review', zoneCodes: [] });
  });
});

describe('activity search', () => {
  const first = (query: string, lang: 'ar' | 'en' = 'ar') => searchActivities(query, lang)[0]?.code;
  const codes = (query: string, lang: 'ar' | 'en' = 'ar') => searchActivities(query, lang).map((activity) => activity.code);

  it('returns the whole list, in catalogue order, for an empty query', () => {
    expect(searchActivities('', 'ar')).toEqual(activities);
    expect(searchActivities('   ', 'en')).toEqual(activities);
    expect(searchActivities(' … ', 'en')).toEqual(activities);
    expect(searchActivities('', 'ar', 5)).toEqual(activities.slice(0, 5));
  });

  it.each([
    ['بلاستيك', PLASTICS],
    ['مصنع بلاستيك', PLASTICS],
    ['أغذية', FOOD],
    ['مواد غذائية', FOOD],
    ['عصائر', BEVERAGES],
    ['مطبعة', PRINTING],
    ['حدادة', METAL],
    ['مستودع', DRY_WAREHOUSING],
    ['مخازن تبريد', 'ACT-502'],
    ['متجر إلكتروني', 'ACT-503'],
    ['حاويات', CONTAINERS],
    ['ورشة سيارات', 'ACT-601'],
    ['قطع غيار', AUTO_PARTS],
    ['معرض', SHOWROOMS],
    ['مكتب', 'ACT-702'],
    ['أدوية', PHARMA],
    ['خردة', 'ACT-801'],
    ['ديزل', FUEL_STORAGE],
  ])('finds «%s» in Arabic', (query, code) => {
    expect(first(query, 'ar')).toBe(code);
    expect(first(query, 'en')).toBe(code);
  });

  it.each([
    ['plastic', PLASTICS],
    ['plastics factory', PLASTICS],
    ['food', FOOD],
    ['bakery', FOOD],
    ['juice', BEVERAGES],
    ['printing', PRINTING],
    ['welding', METAL],
    ['warehouse', DRY_WAREHOUSING],
    ['cold storage', 'ACT-502'],
    ['e-commerce', 'ACT-503'],
    ['containers', CONTAINERS],
    ['garage', 'ACT-601'],
    ['spare parts', AUTO_PARTS],
    ['showroom', SHOWROOMS],
    ['office', 'ACT-702'],
    ['medicines', PHARMA],
    ['scrap', 'ACT-801'],
    ['diesel', FUEL_STORAGE],
  ])('finds "%s" in English', (query, code) => {
    expect(first(query, 'en')).toBe(code);
    expect(first(query, 'ar')).toBe(code);
  });

  it('matches Arabic spelling variants', () => {
    expect(first('البلاستيك')).toBe(PLASTICS);
    expect(first('بِلاستيك')).toBe(PLASTICS);
    expect(first('اغذيه')).toBe(FOOD);
    expect(first('الادوية')).toBe(PHARMA);
    expect(first('ورشه')).toBe(first('ورشة'));
  });

  it('finds an activity by its code', () => {
    expect(codes('ACT-201')).toEqual([PLASTICS]);
    expect(codes('act-602', 'en')).toEqual([AUTO_PARTS]);
  });

  it('finds non-targeted activities too, so the investor learns why', () => {
    expect(first('سكن عمال')).toBe(LABOUR_ACCOMMODATION);
    expect(first('مول')).toBe(RETAIL_MALL);
    expect(first('شقق')).toBe(RESIDENTIAL);
    expect(first('labour camp', 'en')).toBe(LABOUR_ACCOMMODATION);
    expect(first('shopping mall', 'en')).toBe(RETAIL_MALL);
  });

  it('searches the sector as well', () => {
    expect(codes('logistics', 'en')).toEqual(expect.arrayContaining([DRY_WAREHOUSING, 'ACT-502', 'ACT-503', 'ACT-504', CONTAINERS]));
    expect(codes('الصناعات الخفيفة')).toEqual(expect.arrayContaining(['ACT-401', PRINTING, 'ACT-403', 'ACT-404', 'ACT-405']));
  });

  it('is not put off by particles or by words any company could use', () => {
    expect(first('storage of containers', 'en')).toBe(CONTAINERS);
    expect(first('تخزين في مستودع')).toBe(DRY_WAREHOUSING);
    expect(first('شركة بلاستيك')).toBe(PLASTICS);
    expect(first('plastics company', 'en')).toBe(PLASTICS);
    // …but keeps such a word when it is part of a name.
    expect(first('business services', 'en')).toBe('ACT-702');
  });

  it('finds nothing for an activity that is not on the list', () => {
    expect(codes('مصنع طائرات')).toEqual([]);
    expect(codes('aircraft', 'en')).toEqual([]);
    expect(codes('شركة')).toEqual([]);
    expect(codes('the', 'en')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(searchActivities('مصنع', 'ar').length).toBeGreaterThan(5);
    expect(searchActivities('مصنع', 'ar', 3)).toHaveLength(3);
  });
});
