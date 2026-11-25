/**
 * Small pure helpers over the demo world: finding records, replacing them without mutation, and the
 * facts several effects need (which plot a request is about, what a lease costs).
 */
import { getSolution, getZone } from '@/data/catalog';
import type { L10n, SolutionKey } from '@/data/types';
import type { DocFacts } from '@/domain/documents';
import { findPlot, plotsFor, type PlotCell } from '@/domain/plots';
import type { AppNotification, Doc, FormValue, Invoice, Lease, Plot, RequestState, World } from '@/domain/types';
import { allocate } from './refs';

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Rent invoices are due this long after they are issued. */
export const PAYMENT_TERM_MS = 30 * DAY;
/** A renewal case opens this long before a lease ends (the published standard). */
export const RENEWAL_WINDOW_MS = 120 * DAY;

export const isFinished = (request: RequestState): boolean => request.status === 'done' || request.status === 'stopped';
export const isOpen = (request: RequestState): boolean => !isFinished(request);
/** Created, but its workflow was not in memory yet: it starts at the next tick. */
export const isQueued = (request: RequestState): boolean => request.visits.length === 0 && isOpen(request);

export const findRequest = (world: World, id: string): RequestState | undefined => world.requests.find((request) => request.id === id);
export const findPlotRecord = (world: World, id: string | undefined): Plot | undefined => (id === undefined ? undefined : world.plots.find((plot) => plot.id === id));
export const findLease = (world: World, id: string | undefined): Lease | undefined => (id === undefined ? undefined : world.leases.find((lease) => lease.id === id));
export const leaseOfPlot = (world: World, plotId: string | undefined): Lease | undefined => findLease(world, findPlotRecord(world, plotId)?.leaseId);

/** Replaces the request with the same id, or adds it at the end. */
export function putRequest(world: World, request: RequestState): World {
  const index = world.requests.findIndex((existing) => existing.id === request.id);
  if (index < 0) return { ...world, requests: [...world.requests, request] };
  const requests = world.requests.slice();
  requests[index] = request;
  return { ...world, requests };
}

export function patchRequest(world: World, id: string, patch: Partial<RequestState>): World {
  const request = findRequest(world, id);
  return request ? putRequest(world, { ...request, ...patch }) : world;
}

export function patchPlot(world: World, id: string, patch: Partial<Plot>): World {
  if (!world.plots.some((plot) => plot.id === id)) return world;
  return { ...world, plots: world.plots.map((plot) => (plot.id === id ? { ...plot, ...patch } : plot)) };
}

export function patchLease(world: World, id: string, patch: Partial<Lease>): World {
  if (!world.leases.some((lease) => lease.id === id)) return world;
  return { ...world, leases: world.leases.map((lease) => (lease.id === id ? { ...lease, ...patch } : lease)) };
}

export function patchInvoice(world: World, id: string, patch: Partial<Invoice>): World {
  if (!world.invoices.some((invoice) => invoice.id === id)) return world;
  return { ...world, invoices: world.invoices.map((invoice) => (invoice.id === id ? { ...invoice, ...patch } : invoice)) };
}

export const addDocs = (world: World, docs: Doc[]): World => (docs.length ? { ...world, docs: [...world.docs, ...docs] } : world);

/** Raises a notification. They are kept newest first when read; here they are simply appended. */
export function notify(world: World, input: Omit<AppNotification, 'id' | 'read'>): World {
  const next = allocate(world, 'n');
  return { ...next.world, notifications: [...next.world.notifications, { ...input, id: next.id, read: false }] };
}

/** Every request of the same intent, oldest first. */
export function threadOf(world: World, request: RequestState): RequestState[] {
  return world.requests.filter((other) => other.threadId === request.threadId).sort((a, b) => a.createdAt - b.createdAt);
}

export const zoneName = (code: string | undefined): L10n | undefined => (code === undefined ? undefined : getZone(code)?.name);

/** What a document about this plot may quote. */
export function docFacts(world: World, plotId: string | undefined): DocFacts {
  const plot = findPlotRecord(world, plotId);
  const lease = findLease(world, plot?.leaseId);
  const zone = zoneName(plot?.zoneCode);
  return { company: world.company, ...(plot ? { plot } : {}), ...(zone ? { zoneName: zone } : {}), ...(lease ? { lease } : {}) };
}

/* ───────────────────────────── leases ───────────────────────────── */

export type BillingPeriod = 'quarter' | 'year';

/** Published lease terms by solution: long-term leases are invoiced quarterly, one-year yards once a year. */
const TERMS: Record<SolutionKey, { years: number; period: BillingPeriod }> = {
  logistics: { years: 25, period: 'quarter' },
  industrial: { years: 25, period: 'quarter' },
  commercial: { years: 30, period: 'quarter' },
  openYard: { years: 1, period: 'year' },
  warehousing: { years: 1, period: 'year' },
};

export const leaseYears = (solution: SolutionKey): number => TERMS[solution].years;
export const billingPeriod = (solution: SolutionKey): BillingPeriod => TERMS[solution].period;

/** The published rate in QAR per m² per year (0 where operators set the price). */
export const rateOf = (solution: SolutionKey): number => getSolution(solution)?.price.qarPerSqmYear ?? 0;

export const annualRentOf = (solution: SolutionKey, areaSqm: number): number => Math.round(rateOf(solution) * areaSqm);

/** The rent of one billing period. */
export const periodRentOf = (solution: SolutionKey, annualRent: number): number => (billingPeriod(solution) === 'year' ? annualRent : Math.round(annualRent / 4));

/** The same calendar day `years` later (leases end the day before). */
export function addYears(at: number, years: number): number {
  const date = new Date(at);
  date.setFullYear(date.getFullYear() + years);
  return date.getTime();
}

/** Midnight (device time) of the day `at` falls on. */
export function startOfDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/* ───────────────────────────── the plot of an application ───────────────────────────── */

export interface PlotFacts {
  id: string | undefined;
  number: string;
  zoneCode: string;
  areaSqm: number;
  solution: SolutionKey;
}

const SOLUTIONS: SolutionKey[] = ['logistics', 'industrial', 'commercial', 'openYard', 'warehousing'];
const asSolution = (value: FormValue | undefined): SolutionKey | undefined => (typeof value === 'string' && (SOLUTIONS as string[]).includes(value) ? (value as SolutionKey) : undefined);
const asText = (value: FormValue | undefined): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const asNumber = (value: FormValue | undefined): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const DEFAULT_AREA_SQM = 5000;

/**
 * The plot a land application is about, before it exists as a record. Read from what the thread's
 * forms hold (`plotNumber` or `preferredPlot`, `zone` or `zoneCode`, `solution`, `areaSqm` for the
 * plot's exact area, `area` for the area asked for), the zone's illustrative plot layout, the saved
 * eligibility result, and the zone's first solution. A picked plot's own area wins over the area
 * asked for. Never fails, and never invents a plot: without a plot of the zone's layout, the free
 * plot closest to the asked area stands in.
 */
export function plotFacts(world: World, request: RequestState): PlotFacts {
  const thread = threadOf(world, request);
  const form: Record<string, FormValue> = {};
  for (const member of thread) Object.assign(form, member.form);
  const plotId = request.plotId ?? thread.find((member) => member.plotId !== undefined)?.plotId;
  const picked = asText(form.plotNumber) ?? asText(form.preferredPlot) ?? plotId;

  const candidates = [request.zoneCode, thread.find((member) => member.zoneCode !== undefined)?.zoneCode, asText(form.zoneCode), asText(form.zone), world.eligibility?.zoneCodes[0], picked?.split('-')[0]];
  const zoneCode = candidates.find((code) => code !== undefined && getZone(code) !== undefined) ?? 'BA';
  const asked = asNumber(form.areaSqm) ?? asNumber(form.area) ?? world.eligibility?.areaSqm ?? DEFAULT_AREA_SQM;
  // A plot that is not in the zone's layout is never invented: the free plot closest to the asked size stands in for it.
  const cell = (picked ? findPlot(zoneCode, picked) : undefined) ?? freeCell(world, zoneCode, asked);
  const zone = getZone(zoneCode);
  const fromZone = zone?.solutions[0];
  const wanted = asSolution(form.solution) ?? world.eligibility?.solution;
  // A solution the zone does not offer cannot be leased there: the zone's own solution wins.
  const solution = wanted && (!zone || zone.solutions.includes(wanted)) ? wanted : (fromZone ?? wanted ?? 'logistics');

  return {
    id: plotId,
    number: cell.id,
    zoneCode,
    areaSqm: asNumber(form.areaSqm) ?? cell.areaSqm,
    solution,
  };
}

/** The available plot of a zone's layout that is closest to the asked area and not already on record. */
function freeCell(world: World, zoneCode: string, areaSqm: number): PlotCell {
  const taken = new Set(world.plots.map((plot) => plot.number));
  const cells = plotsFor(zoneCode);
  const free = cells.filter((cell) => cell.status === 'available' && !taken.has(cell.id));
  const pool = free.length ? free : cells;
  return pool.reduce((best, cell) => (Math.abs(cell.areaSqm - areaSqm) < Math.abs(best.areaSqm - areaSqm) ? cell : best), pool[0] as PlotCell);
}
