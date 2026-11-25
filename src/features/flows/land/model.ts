/**
 * The land application (service A4) as data: the answers, where they start from (the link, the saved
 * eligibility check, the verified company, a saved draft), what each page needs before going on, and
 * what is handed to `startRequest`. Pure, so it is unit-tested.
 */
import { getActivity, getZone } from '@/data/catalog';
import type { SolutionKey } from '@/data/types';
import type { Company, EligibilityResult, FormValue } from '@/domain/types';
import { findPlot } from '@/domain/plots';
import { estimateAnnualRent } from '@/domain/eligibility';
import { DEFAULT_AREA, freePlots, isValidArea, LAND_SOLUTIONS, zonesOffering } from '../eligibility/model';

export const LAND_PAGES = 5;

/** The documents of the application, in order; the last one is optional. */
export const LAND_DOCS = ['businessPlan', 'financials', 'solutionDocs'] as const;
export type LandDoc = (typeof LAND_DOCS)[number];
export const REQUIRED_DOCS: readonly LandDoc[] = ['businessPlan', 'financials'];

/** The most alternatives an application lists, in order. */
export const MAX_ALTERNATIVES = 3;

export interface PickedDoc {
  name: string;
  size?: number;
}

export interface LandForm {
  detailsConfirmed: boolean;
  activity: string | null;
  solution: SolutionKey;
  area: number | null;
  zone: string | null;
  preferredPlot: string | null;
  /** In the investor's order of preference. */
  alternativePlots: string[];
  businessPlan: PickedDoc | null;
  financials: PickedDoc | null;
  solutionDocs: PickedDoc | null;
  consent: boolean;
}

const isLandSolution = (value: unknown): value is SolutionKey => LAND_SOLUTIONS.some((key) => key === value);
const isDoc = (value: FormValue | undefined): value is PickedDoc => value !== null && typeof value === 'object' && 'name' in value && !('id' in value) && !('phone' in value);
const text = (value: FormValue | undefined): string | null => (typeof value === 'string' && value ? value : null);

/** The first land zone that offers a solution and, when known, targets the activity. */
function firstZone(solution: SolutionKey, activityCode: string | null, prefer: readonly string[] = []): string | null {
  const offering = zonesOffering(solution).filter((zone) => zone.kind === 'land');
  const targeted = activityCode ? getActivity(activityCode)?.zones ?? [] : [];
  const ordered = [...prefer, ...targeted, ...offering.map((zone) => zone.code)];
  return ordered.find((code) => offering.some((zone) => zone.code === code)) ?? null;
}

export interface Seed {
  query: Record<string, string | undefined>;
  eligibility: EligibilityResult | null;
  company: Company | null;
}

/** A fresh application: what the link asks for, then the saved check, then the company's own activity. */
export function initialForm({ query, eligibility, company }: Seed): LandForm {
  const activity = query.activity && getActivity(query.activity) ? query.activity : eligibility?.activityCode ?? company?.activityCode ?? null;
  const activitySolutions = activity ? getActivity(activity)?.solutions ?? [] : [];
  const solution: SolutionKey = isLandSolution(eligibility?.solution) ? eligibility.solution : activitySolutions.find(isLandSolution) ?? 'logistics';
  const area = eligibility && isValidArea(eligibility.areaSqm) ? eligibility.areaSqm : DEFAULT_AREA;
  const plotZone = query.plot ? query.plot.split('-')[0] : undefined;
  const askedZone = query.zone ?? plotZone;
  const zone = askedZone && getZone(askedZone)?.solutions.includes(solution) ? askedZone : firstZone(solution, activity, eligibility?.zoneCodes);
  const plot = query.plot && zone && findPlot(zone, query.plot)?.status === 'available' ? query.plot : null;
  return {
    detailsConfirmed: false,
    activity,
    solution,
    area,
    zone,
    preferredPlot: plot,
    alternativePlots: [],
    businessPlan: null,
    financials: null,
    solutionDocs: null,
    consent: false,
  };
}

/** The answers as a draft (`saveDraft` keeps flat form values). */
export function toDraft(form: LandForm): Record<string, FormValue> {
  return {
    detailsConfirmed: form.detailsConfirmed,
    activity: form.activity,
    solution: form.solution,
    area: form.area,
    zone: form.zone,
    preferredPlot: form.preferredPlot,
    alternativePlots: form.alternativePlots.join(','),
    businessPlan: form.businessPlan,
    financials: form.financials,
    solutionDocs: form.solutionDocs,
  };
}

/** A saved draft back as answers, on top of a fresh form; anything malformed keeps the fresh value. */
export function fromDraft(draft: Record<string, FormValue>, base: LandForm): LandForm {
  const area = typeof draft.area === 'number' && isValidArea(draft.area) ? draft.area : base.area;
  const solution = isLandSolution(draft.solution) ? draft.solution : base.solution;
  const zone = text(draft.zone) && getZone(text(draft.zone) as string)?.solutions.includes(solution) ? (text(draft.zone) as string) : base.zone;
  const activity = text(draft.activity) && getActivity(text(draft.activity) as string) ? text(draft.activity) : base.activity;
  return {
    ...base,
    detailsConfirmed: draft.detailsConfirmed === true,
    activity,
    solution,
    area,
    zone,
    preferredPlot: text(draft.preferredPlot) ?? base.preferredPlot,
    alternativePlots: (text(draft.alternativePlots) ?? '').split(',').filter(Boolean).slice(0, MAX_ALTERNATIVES),
    businessPlan: isDoc(draft.businessPlan) ? draft.businessPlan : null,
    financials: isDoc(draft.financials) ? draft.financials : null,
    solutionDocs: isDoc(draft.solutionDocs) ? draft.solutionDocs : null,
  };
}

/** Whether the investor has answered anything worth keeping. */
export function isDirty(form: LandForm, fresh: LandForm): boolean {
  return JSON.stringify(toDraft(form)) !== JSON.stringify(toDraft(fresh));
}

/** The plot chosen, if it still fits: in the zone, free, and at least the area asked for. */
export function chosenPlot(form: LandForm, taken: ReadonlySet<string>) {
  if (!form.zone || !form.preferredPlot || !isValidArea(form.area)) return undefined;
  return freePlots(form.zone, form.area, taken).find((plot) => plot.id === form.preferredPlot);
}

/** The alternatives that still fit, in order. */
export function validAlternatives(form: LandForm, taken: ReadonlySet<string>): string[] {
  if (!form.zone || !isValidArea(form.area)) return [];
  const free = new Set(freePlots(form.zone, form.area, taken).map((plot) => plot.id));
  return form.alternativePlots.filter((id) => id !== form.preferredPlot && free.has(id));
}

/** Toggles a plot in the ordered list of alternatives (at most three). */
export function toggleAlternative(list: readonly string[], id: string): string[] {
  if (list.includes(id)) return list.filter((item) => item !== id);
  return list.length >= MAX_ALTERNATIVES ? [...list] : [...list, id];
}

export type LandError = 'confirm' | 'area' | 'zone' | 'plot' | 'activity' | 'businessPlan' | 'financials' | 'consent';

/** What a page still needs before the investor can go on (empty when it is complete). */
export function pageErrors(page: number, form: LandForm, taken: ReadonlySet<string>): LandError[] {
  const errors: LandError[] = [];
  if (page === 1 && !form.detailsConfirmed) errors.push('confirm');
  if (page === 2) {
    if (!isValidArea(form.area)) errors.push('area');
    else if (!form.zone) errors.push('zone');
    else if (!chosenPlot(form, taken)) errors.push('plot');
  }
  if (page === 3 && !form.activity) errors.push('activity');
  if (page === 4) for (const doc of REQUIRED_DOCS) if (!form[doc]) errors.push(doc);
  if (page === 5) {
    for (let earlier = 1; earlier < 5; earlier++) errors.push(...pageErrors(earlier, form, taken));
    if (!form.consent) errors.push('consent');
  }
  return errors;
}

/** The first page with something missing, or null when the whole application is complete. */
export function firstIncompletePage(form: LandForm, taken: ReadonlySet<string>): number | null {
  for (let page = 1; page < LAND_PAGES; page++) if (pageErrors(page, form, taken).length) return page;
  return null;
}

/** The estimated annual rent of the chosen plot at the published price (null when none is chosen). */
export function plotRent(form: LandForm, taken: ReadonlySet<string>): number | null {
  const plot = chosenPlot(form, taken);
  return plot ? estimateAnnualRent(form.solution, plot.areaSqm) : null;
}

/** What `startRequest('A4', …)` receives: the answers, the plot's own area and the documents. */
export function toRequestForm(form: LandForm, taken: ReadonlySet<string>): Record<string, FormValue> {
  const plot = chosenPlot(form, taken);
  return {
    detailsConfirmed: true,
    activity: form.activity,
    solution: form.solution,
    area: form.area,
    ...(plot ? { areaSqm: plot.areaSqm, preferredPlot: plot.id } : {}),
    alternativePlots: validAlternatives(form, taken).join(','),
    businessPlan: form.businessPlan,
    financials: form.financials,
    ...(form.solutionDocs ? { solutionDocs: form.solutionDocs } : {}),
  };
}
