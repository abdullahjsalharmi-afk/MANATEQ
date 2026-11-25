/** Pure helpers of the zones explorer: filtering, published prices, shares and the rent estimate. */
import { getSolution, zones as allZones } from '@/data/catalog';
import type { Solution, SolutionKey, Zone } from '@/data/types';

export type ZoneFilter = 'all' | SolutionKey;

/** The filter chips, in the order they are shown. */
export const FILTERS: ZoneFilter[] = ['all', 'logistics', 'industrial', 'commercial', 'openYard', 'warehousing'];

export const MIN_AREA = 100;
export const MAX_AREA = 1_000_000;

export function isZoneFilter(value: string | undefined): value is ZoneFilter {
  return value !== undefined && (FILTERS as string[]).includes(value);
}

/** The zones that offer a solution, in catalogue order; every zone for 'all'. */
export function zonesFor(filter: ZoneFilter, zones: Zone[] = allZones): Zone[] {
  return filter === 'all' ? zones : zones.filter((zone) => zone.solutions.includes(filter));
}

/** The share of a land zone already allocated, as a whole percentage; null for warehousing parks. */
export function allocatedPct(zone: Zone): number | null {
  if (zone.allocatedSqm === undefined || zone.totalSqm <= 0) return null;
  return Math.round((zone.allocatedSqm / zone.totalSqm) * 100);
}

/** The share a zone is taken up: allocated land for land zones, occupancy for parks. */
export function takenPct(zone: Zone): number | null {
  return zone.kind === 'land' ? allocatedPct(zone) : (zone.occupancyPct ?? null);
}

/** The solutions a zone offers, in the zone's own order. */
export function solutionsOf(zone: Zone): Solution[] {
  return zone.solutions.map((key) => getSolution(key)).filter((solution): solution is Solution => solution !== undefined);
}

/**
 * The published price to quote for a zone: the lowest published price per m² a year among its solutions,
 * and whether it is a floor ("from") because other solutions there cost more. `amount` is null where the
 * operator sets the price (warehousing parks).
 */
export function zonePrice(zone: Zone): { amount: number | null; from: boolean } {
  const prices = solutionsOf(zone)
    .map((solution) => solution.price.qarPerSqmYear)
    .filter((price): price is number => price !== null);
  if (prices.length === 0) return { amount: null, from: false };
  const amount = Math.min(...prices);
  return { amount, from: new Set(prices).size > 1 };
}

/** The yearly rent estimate: area × published price. Null when the price is the operator's or the area is out of range. */
export function annualEstimate(areaSqm: number | null, key: SolutionKey): number | null {
  const price = getSolution(key)?.price.qarPerSqmYear ?? null;
  if (price === null || areaSqm === null || !isValidArea(areaSqm)) return null;
  return Math.round(areaSqm * price);
}

export function isValidArea(areaSqm: number | null): boolean {
  return areaSqm !== null && Number.isFinite(areaSqm) && areaSqm >= MIN_AREA && areaSqm <= MAX_AREA;
}

/** Where to go to apply for a plot: the land application for an investor, the welcome for a guest. */
export function applyTarget(zoneCode: string, plotId: string, guest: boolean): string {
  if (guest) return '/welcome';
  return `/start/A4?zone=${encodeURIComponent(zoneCode)}&plot=${encodeURIComponent(plotId)}`;
}
