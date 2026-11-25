/**
 * The pure part of the eligibility check screen (service A2) and of the land application (A4):
 * which plots are free, how the activity list is grouped, which render stands for a solution, and
 * what the result says in three short facts. No React here, so every rule is unit-tested.
 */
import { getActivity, getZone, solutions, zones } from '@/data/catalog';
import type { Activity, L10n, Lang, SolutionKey, Zone } from '@/data/types';
import type { Availability, EligibilityOption, EligibilityOutcome } from '@/domain/eligibility';
import { plotsFor, type PlotCell } from '@/domain/plots';
import type { RenderName } from '@/design/core';

/** The quick picks under the area field, in m². */
export const AREA_PICKS = [2500, 5000, 10000, 20000] as const;

/** The area a check starts from when nothing else is known. */
export const DEFAULT_AREA = 5000;

/** The smallest and largest area the check accepts, in m². */
export const AREA_MIN = 100;
export const AREA_MAX = 1_000_000;

/**
 * The few activities shown before any search (SPEC 4.0, the configurator: a search pill and a handful of
 * chips): one per main sector of the zones. The whole register is a search or one tap away.
 */
export const POPULAR_ACTIVITIES = ['ACT-101', 'ACT-301', 'ACT-501', 'ACT-502', 'ACT-601', 'ACT-702'] as const;

/**
 * The chips to show before a search: the activity already chosen (when it is not the licensed one),
 * then the popular ones, without repeats, at most `max`.
 */
export function quickActivities(chosen: string | null, licensed: string | undefined, max = 7): string[] {
  const list: string[] = [];
  for (const code of [chosen, ...POPULAR_ACTIVITIES]) {
    if (!code || code === licensed || list.includes(code) || !getActivity(code)) continue;
    list.push(code);
  }
  return list.slice(0, max);
}

/** True when an activity's verdict does not depend on the solution or the area (not targeted anywhere). */
export function decidedByActivity(code: string | null): boolean {
  return code !== null && getActivity(code)?.verdict === 'not_targeted';
}

/** The solutions in their published order: the land solutions first, ready-built warehousing last. */
export const SOLUTION_ORDER: SolutionKey[] = solutions.map((solution) => solution.key);

/** The solutions a land application can ask for: everything but ready-built warehousing (leased through the operators, F1). */
export const LAND_SOLUTIONS: SolutionKey[] = SOLUTION_ORDER.filter((key) => key !== 'warehousing');

/** The render that stands for each solution (SPEC 3.5). */
export const SOLUTION_RENDER: Record<SolutionKey, RenderName> = {
  industrial: 'factory',
  logistics: 'warehouse',
  commercial: 'showroom',
  openYard: 'yard',
  warehousing: 'units',
};

/** True when an area is a whole number of square metres the check accepts. */
export function isValidArea(area: number | null | undefined): area is number {
  return typeof area === 'number' && Number.isFinite(area) && area >= AREA_MIN && area <= AREA_MAX;
}

/**
 * The plots of a zone's illustrative layout that the investor can apply for: available in the layout,
 * at least `areaSqm`, and not already the investor's or under one of their applications (`taken`).
 */
export function freePlots(zoneCode: string, areaSqm: number, taken: ReadonlySet<string> = new Set()): PlotCell[] {
  const zone = getZone(zoneCode);
  if (!zone || zone.kind !== 'land') return [];
  return plotsFor(zoneCode).filter((plot) => plot.status === 'available' && plot.areaSqm >= areaSqm && !taken.has(plot.id));
}

/** The availability the rules read, from the illustrative layouts (the GIS land register in the target state). */
export function layoutAvailability(taken: ReadonlySet<string> = new Set()): Availability {
  return (zoneCode, areaSqm) => freePlots(zoneCode, areaSqm, taken).length;
}

/**
 * The layout to draw on the plot map: a free plot the investor already applied for is drawn as not
 * available. A free plot smaller than the area stays available in the layout; the map dims it and says
 * why through `PlotGrid`'s `isSelectable` (see `fitsArea`), so it is never mistaken for a leased plot.
 */
export function layoutForArea(zoneCode: string, taken: ReadonlySet<string> = new Set(), own: ReadonlySet<string> = new Set()): PlotCell[] {
  return plotsFor(zoneCode).map((plot) => (plot.status === 'available' && !own.has(plot.id) && taken.has(plot.id) ? { ...plot, status: 'allocated' } : plot));
}

/** Whether a plot is large enough for the area asked for (the `isSelectable` of the land application's map). */
export function fitsArea(plot: PlotCell, areaSqm: number): boolean {
  return plot.areaSqm >= areaSqm;
}

/** The zones that offer a solution, land zones before warehousing parks, in catalogue order. */
export function zonesOffering(solution: SolutionKey): Zone[] {
  return zones.filter((zone) => zone.solutions.includes(solution));
}

export interface SectorGroup {
  sector: L10n;
  activities: Activity[];
}

/** Groups activities by sector, keeping the order in which each sector first appears. */
export function groupBySector(list: readonly Activity[], lang: Lang): SectorGroup[] {
  const groups = new Map<string, SectorGroup>();
  for (const activity of list) {
    const key = activity.sector[lang];
    const group = groups.get(key) ?? { sector: activity.sector, activities: [] };
    group.activities.push(activity);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** How the result reads: four outcomes for the investor, never a red "rejected". */
export type ResultKind = 'eligible' | 'elsewhere' | 'noPlots' | 'review' | 'notTargeted';

export function resultKind(outcome: EligibilityOutcome): ResultKind {
  if (outcome.verdict === 'review') return 'review';
  if (outcome.verdict === 'not_targeted') return 'notTargeted';
  if (outcome.eligible) return 'eligible';
  if (outcome.obstacle === 'plots') return 'noPlots';
  // Another option is only worth offering when one of them has a free plot of the size (or the operator
  // reports availability): when none has, the activity is targeted but no plot of this size is free now.
  return outcome.alternatives.length > 0 && !outcome.alternatives.some(hasFreePlot) ? 'noPlots' : 'elsewhere';
}

/** True when an option may have room: a free plot of the size, or availability the operator reports (`null`). */
export function hasFreePlot(option: Pick<EligibilityOption, 'plotHint'>): boolean {
  return option.plotHint === null || option.plotHint > 0;
}

/** One short fact under the verdict: what the rules found, with a yes or a no (never colour alone). */
export interface Fact {
  key: 'activity' | 'solution' | 'plots' | 'operator';
  ok: boolean;
}

/** The three facts behind a targeted verdict; none for a review or a non-targeted activity. */
export function factsOf(outcome: EligibilityOutcome, solution: SolutionKey): Fact[] {
  if (outcome.verdict !== 'targeted') return [];
  const fitsAsAsked = outcome.obstacle === null || outcome.obstacle === 'plots';
  const facts: Fact[] = [
    { key: 'activity', ok: true },
    { key: 'solution', ok: fitsAsAsked },
  ];
  if (solution === 'warehousing') facts.push({ key: 'operator', ok: true });
  else if (fitsAsAsked) facts.push({ key: 'plots', ok: outcome.obstacle !== 'plots' });
  return facts;
}

/** The zone an application should start in: the one chosen on the result, else the first match with a free plot. */
export function firstZoneWithPlots(outcome: EligibilityOutcome): string | undefined {
  const withPlots = outcome.matches.find((match) => match.plotHint === null || match.plotHint > 0);
  return (withPlots ?? outcome.matches[0])?.zone.code;
}

/** An unlisted activity is described in a few words at least (the same floor as a required text answer). */
export function isUnlistedDescribed(text: string): boolean {
  return text.trim().length >= 3;
}
