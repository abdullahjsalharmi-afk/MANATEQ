import { describe, expect, it } from 'vitest';
import { checkEligibility, UNLISTED_ACTIVITY } from '@/domain/eligibility';
import { plotsFor } from '@/domain/plots';
import type { Company } from '@/domain/types';
import { decidedByActivity, factsOf, freePlots, groupBySector, POPULAR_ACTIVITIES, quickActivities, isValidArea, layoutAvailability, layoutForArea, resultKind } from '@/features/flows/eligibility/model';
import { choicesOf, choiceKey, defaultChoice, primaryOf } from '@/features/flows/eligibility/Result';
import { activities } from '@/data/catalog';
import {
  chosenPlot,
  firstIncompletePage,
  fromDraft,
  initialForm,
  isDirty,
  pageErrors,
  toDraft,
  toggleAlternative,
  toRequestForm,
  type LandForm,
} from '@/features/flows/land/model';

const FOOD = 'ACT-101';
const company: Company = {
  name: { ar: 'شركة', en: 'Co.' },
  cr: '1-2345',
  activity: { ar: 'تخزين', en: 'Storage' },
  activityCode: 'ACT-501',
  signatory: { name: { ar: 'أ', en: 'A' }, role: { ar: 'مدير', en: 'Manager' } },
  syncedAt: 0,
};

describe('eligibility model', () => {
  it('counts free plots of at least the area, leaving out the ones taken', () => {
    const all = freePlots('BA', 2500);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((plot) => plot.status === 'available' && plot.areaSqm >= 2500)).toBe(true);
    const first = all[0]!.id;
    expect(freePlots('BA', 2500, new Set([first])).map((plot) => plot.id)).not.toContain(first);
    expect(freePlots('WK', 100)).toEqual([]);
  });

  it('draws plots that are too small as unavailable and keeps the layout whole', () => {
    const layout = layoutForArea('AW', 5000);
    expect(layout).toHaveLength(plotsFor('AW').length);
    expect(layout.filter((plot) => plot.status === 'available').every((plot) => plot.areaSqm >= 5000)).toBe(true);
  });

  it('accepts sensible areas only', () => {
    expect(isValidArea(5000)).toBe(true);
    expect(isValidArea(0)).toBe(false);
    expect(isValidArea(null)).toBe(false);
    expect(isValidArea(Number.NaN)).toBe(false);
  });

  it('groups activities by sector in order', () => {
    const groups = groupBySector(activities, 'en');
    expect(groups.flatMap((group) => group.activities)).toHaveLength(activities.length);
    expect(new Set(groups.map((group) => group.sector.en)).size).toBe(groups.length);
  });

  it('reads food products on 5,000 m² of logistics land as eligible in the logistics parks', () => {
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'logistics', areaSqm: 5000 }, layoutAvailability());
    expect(resultKind(outcome)).toBe('eligible');
    expect(outcome.matches.map((match) => match.zone.code).sort()).toEqual(['AS', 'AW', 'BA', 'JS']);
    expect(factsOf(outcome, 'logistics').every((fact) => fact.ok)).toBe(true);
    const primary = primaryOf(outcome, { persona: 'prospect', chosen: null, activityCode: FOOD, solution: 'logistics' });
    expect(primary.kind).toBe('apply');
    expect(primary.zone).toBe(outcome.matches.find((match) => (match.plotHint ?? 1) > 0)?.zone.code);
    expect(primaryOf(outcome, { persona: 'guest', chosen: null, activityCode: FOOD, solution: 'logistics' }).kind).toBe('signIn');
  });

  it('follows the chosen zone, and ignores a choice that is not on the result', () => {
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'logistics', areaSqm: 5000 }, layoutAvailability());
    const js = choicesOf(outcome).find((option) => option.zone.code === 'JS')!;
    expect(primaryOf(outcome, { persona: 'tenant', chosen: choiceKey(js), activityCode: FOOD, solution: 'logistics' }).zone).toBe('JS');
    expect(primaryOf(outcome, { persona: 'tenant', chosen: 'nope:XX', activityCode: FOOD, solution: 'logistics' }).chosen).toBe(defaultChoice(outcome));
  });

  it('offers alternatives and a re-check when the first choice does not fit', () => {
    const outcome = checkEligibility({ activityCode: FOOD, solution: 'openYard', areaSqm: 5000 }, layoutAvailability());
    expect(resultKind(outcome)).toBe('elsewhere');
    expect(choicesOf(outcome).length).toBeGreaterThan(0);
    expect(factsOf(outcome, 'openYard').find((fact) => fact.key === 'solution')?.ok).toBe(false);
    const primary = primaryOf(outcome, { persona: 'prospect', chosen: null, activityCode: FOOD, solution: 'openYard' });
    expect(primary.kind).toBe('recheck');
    expect(primary.solution).toBeDefined();
  });

  it('sends an unlisted activity for review and a non-targeted one to the Business Services Center', () => {
    const review = checkEligibility({ activityCode: UNLISTED_ACTIVITY, solution: 'logistics', areaSqm: 5000 });
    expect(primaryOf(review, { persona: 'prospect', chosen: null, activityCode: UNLISTED_ACTIVITY, solution: 'logistics' }).kind).toBe('review');
    expect(factsOf(review, 'logistics')).toEqual([]);
    const retail = checkEligibility({ activityCode: 'ACT-703', solution: 'commercial', areaSqm: 5000 });
    expect(resultKind(retail)).toBe('notTargeted');
    expect(primaryOf(retail, { persona: 'prospect', chosen: null, activityCode: 'ACT-703', solution: 'commercial' }).kind).toBe('bsc');
  });

  it('refers ready-built warehousing to the operators', () => {
    const outcome = checkEligibility({ activityCode: 'ACT-501', solution: 'warehousing', areaSqm: 2500 }, layoutAvailability());
    expect(primaryOf(outcome, { persona: 'tenant', chosen: null, activityCode: 'ACT-501', solution: 'warehousing' }).kind).toBe('referral');
    expect(factsOf(outcome, 'warehousing').map((fact) => fact.key)).toContain('operator');
  });
});

describe('land application model', () => {
  const eligibility = { at: 0, activityCode: FOOD, solution: 'logistics' as const, areaSqm: 5000, verdict: 'targeted' as const, zoneCodes: ['AW', 'BA'] };

  it('starts from the link, then the saved check, then the company', () => {
    const fromLink = initialForm({ query: { activity: 'ACT-301', zone: 'JS' }, eligibility, company });
    expect(fromLink).toMatchObject({ activity: 'ACT-301', zone: 'JS', solution: 'logistics', area: 5000 });
    const fromCheck = initialForm({ query: {}, eligibility, company });
    expect(fromCheck).toMatchObject({ activity: FOOD, zone: 'AW' });
    const fromCompany = initialForm({ query: {}, eligibility: null, company });
    expect(fromCompany.activity).toBe('ACT-501');
    expect(fromCompany.zone).not.toBeNull();
  });

  it('takes a plot from the link only when it is free in its zone', () => {
    const free = freePlots('AW', 1)[0]!;
    expect(initialForm({ query: { plot: free.id }, eligibility, company }).preferredPlot).toBe(free.id);
    const busy = plotsFor('AW').find((plot) => plot.status !== 'available')!;
    expect(initialForm({ query: { plot: busy.id }, eligibility, company }).preferredPlot).toBeNull();
  });

  it('asks each page for what it needs', () => {
    const form = initialForm({ query: {}, eligibility, company });
    const taken = new Set<string>();
    expect(pageErrors(1, form, taken)).toEqual(['confirm']);
    expect(pageErrors(2, form, taken)).toEqual(['plot']);
    expect(pageErrors(4, form, taken)).toEqual(['businessPlan', 'financials']);
    expect(firstIncompletePage(form, taken)).toBe(1);
    const plot = freePlots('AW', 5000)[0]!;
    const done: LandForm = { ...form, detailsConfirmed: true, preferredPlot: plot.id, businessPlan: { name: 'a.pdf' }, financials: { name: 'b.pdf' }, consent: true };
    expect(firstIncompletePage(done, taken)).toBeNull();
    expect(pageErrors(5, done, taken)).toEqual([]);
    expect(pageErrors(2, done, new Set([plot.id]))).toEqual(['plot']);
    expect(chosenPlot({ ...done, area: plot.areaSqm + 1 }, taken)).toBeUndefined();
  });

  it('keeps alternatives in order, three at most', () => {
    let list: string[] = [];
    for (const id of ['A', 'B', 'C', 'D']) list = toggleAlternative(list, id);
    expect(list).toEqual(['A', 'B', 'C']);
    expect(toggleAlternative(list, 'B')).toEqual(['A', 'C']);
  });

  it('survives a draft round trip and notices changes', () => {
    const fresh = initialForm({ query: {}, eligibility, company });
    const plot = freePlots('AW', 5000)[0]!;
    const form: LandForm = { ...fresh, detailsConfirmed: true, preferredPlot: plot.id, alternativePlots: ['AW-140'], businessPlan: { name: 'plan.pdf', size: 10 } };
    expect(isDirty(fresh, fresh)).toBe(false);
    expect(isDirty(form, fresh)).toBe(true);
    const back = fromDraft(toDraft(form), fresh);
    expect(back).toEqual({ ...form, consent: false });
    expect(fromDraft({ area: -4, solution: 'warehousing', zone: 'NOPE' }, fresh)).toMatchObject({ area: fresh.area, solution: fresh.solution, zone: fresh.zone });
  });

  it('hands the request the plot, its area and the documents', () => {
    const fresh = initialForm({ query: {}, eligibility, company });
    const plots = freePlots('AW', 5000);
    const form: LandForm = { ...fresh, detailsConfirmed: true, preferredPlot: plots[0]!.id, alternativePlots: plots.slice(1, 3).map((plot) => plot.id), businessPlan: { name: 'a.pdf' }, financials: { name: 'b.pdf' } };
    const request = toRequestForm(form, new Set());
    expect(request).toMatchObject({ preferredPlot: plots[0]!.id, areaSqm: plots[0]!.areaSqm, solution: 'logistics', activity: FOOD, businessPlan: { name: 'a.pdf' } });
    expect(request.alternativePlots).toBe(plots.slice(1, 3).map((plot) => plot.id).join(','));
  });
});

describe('eligibility step 1', () => {
  it('shows a handful of activities: the chosen one first, never the licensed one, never twice', () => {
    expect(quickActivities(null, undefined)).toEqual([...POPULAR_ACTIVITIES]);
    expect(quickActivities('ACT-402', 'ACT-101')).toEqual(['ACT-402', ...POPULAR_ACTIVITIES.filter((code) => code !== 'ACT-101')]);
    expect(quickActivities('ACT-501', undefined)).toEqual([...POPULAR_ACTIVITIES].sort((a, b) => (a === 'ACT-501' ? -1 : b === 'ACT-501' ? 1 : 0)));
    expect(quickActivities('nope', undefined).length).toBeLessThanOrEqual(7);
  });

  it('decides a non-targeted activity on the activity alone', () => {
    expect(decidedByActivity('ACT-703')).toBe(true);
    expect(decidedByActivity('ACT-101')).toBe(false);
    expect(decidedByActivity(UNLISTED_ACTIVITY)).toBe(false);
    expect(decidedByActivity(null)).toBe(false);
  });
});
