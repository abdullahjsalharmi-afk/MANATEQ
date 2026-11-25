/**
 * An illustrative plot layout for a zone. The prototype has no land register, so each zone gets a small
 * grid of plots that is invented but stable: the same zone always shows the same plots, statuses and
 * areas, on every device and in every session. It is always shown with an "illustrative" label.
 */
import type { FieldDef, ServiceId, ServiceSummary } from '@/data/types';
import type { Lease, Plot, World } from './types';

export type PlotCellStatus = 'available' | 'allocated' | 'reserved';

export interface PlotCell {
  /** Zone code and plot number, e.g. "BA-117". */
  id: string;
  zoneCode: string;
  /** The number part of the id, e.g. 117. */
  number: number;
  /** Position in the layout, from the top-left corner; both start at 0. */
  row: number;
  col: number;
  status: PlotCellStatus;
  areaSqm: number;
}

export const PLOT_COLS = 8;
export const PLOT_ROWS = 5;

/** Plot numbers start here and run row by row: 101 … 140. */
const FIRST_NUMBER = 101;

/** Shares of the three statuses: about 60% available, 28% allocated, 12% reserved. */
const AVAILABLE_SHARE = 0.6;
const ALLOCATED_SHARE = 0.28;

/** Typical plot sizes in m²; the common sizes appear more than once so they are drawn more often. */
const AREAS_SQM = [1500, 2000, 2500, 2500, 3000, 3000, 4000, 5000, 5000, 7500, 10000];

/** FNV-1a: turns a zone code into a 32-bit seed. */
function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small pseudo-random generator, fully determined by its seed. Returns numbers in [0, 1). */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(zoneCode: string): PlotCell[] {
  const random = generator(seedOf(zoneCode));
  const cells: PlotCell[] = [];
  for (let row = 0; row < PLOT_ROWS; row++) {
    for (let col = 0; col < PLOT_COLS; col++) {
      const number = FIRST_NUMBER + row * PLOT_COLS + col;
      const draw = random();
      const status: PlotCellStatus = draw < AVAILABLE_SHARE ? 'available' : draw < AVAILABLE_SHARE + ALLOCATED_SHARE ? 'allocated' : 'reserved';
      const areaSqm = AREAS_SQM[Math.floor(random() * AREAS_SQM.length)] as number;
      cells.push({ id: `${zoneCode}-${number}`, zoneCode, number, row, col, status, areaSqm });
    }
  }
  return cells;
}

const cache = new Map<string, PlotCell[]>();

/**
 * Two questions under one name:
 *
 * - `plotsFor(zoneCode)`: the illustrative layout of a zone, 8 columns × 5 rows, row by row from the
 *   top-left corner. Deterministic: the result depends only on the zone code.
 * - `plotsFor(world, serviceId)`: the investor's own plots a request of the service can be started for.
 *   The handover (A8) only takes a plot that is leased and not handed over yet; every other service
 *   takes any plot the company holds (a plot only reserved by a running application is not held yet).
 *   Records as stored, in their order.
 */
export function plotsFor(zoneCode: string): PlotCell[];
export function plotsFor(world: Pick<World, 'plots'>, serviceId: ServiceId): Plot[];
export function plotsFor(first: string | Pick<World, 'plots'>, serviceId?: ServiceId): PlotCell[] | Plot[] {
  if (typeof first !== 'string') return plotsOfService(first, serviceId ?? '');
  return layoutOf(first);
}

/** Which of the investor's plots a service can be started for (see `plotsFor`). */
const PLOT_RULES: Partial<Record<ServiceId, (plot: Plot) => boolean>> = {
  A8: (plot) => plot.status === 'leased',
};

const heldPlot = (plot: Plot): boolean => plot.status !== 'reserved';

function plotsOfService(world: Pick<World, 'plots'>, serviceId: ServiceId): Plot[] {
  const rule = PLOT_RULES[serviceId] ?? heldPlot;
  return world.plots.filter(rule);
}

/**
 * True when the service is only for a company that holds a plot: it is offered to tenants and not to
 * prospects, or (when the full record is given) its form asks for a plot and the plot is required.
 * Vendor-only or staff-only services are not about a plot.
 */
export function needsTenancy(service: Pick<ServiceSummary, 'audiences'> & { fields?: Pick<FieldDef, 'key' | 'type' | 'required'>[] }): boolean {
  if (service.audiences.includes('tenant') && !service.audiences.includes('prospect')) return true;
  return (service.fields ?? []).some((field) => (field.type === 'plot' || field.key === 'plot') && field.required === true);
}

function layoutOf(zoneCode: string): PlotCell[] {
  let cells = cache.get(zoneCode);
  if (!cells) {
    cells = build(zoneCode);
    cache.set(zoneCode, cells);
  }
  return cells;
}

/** One plot of a zone by its id ("BA-117"), or undefined when the zone has no such plot. */
export function findPlot(zoneCode: string, id: string): PlotCell | undefined {
  return plotsFor(zoneCode).find((cell) => cell.id === id);
}

/**
 * The lease of one of the investor's plots: the one the plot record points at (`plot.leaseId`), which is
 * its current lease. A plot leased again later keeps pointing at the newer one. Undefined before signing.
 */
export function leaseOfPlot(world: Pick<World, 'plots' | 'leases'>, plotId: string | undefined): Lease | undefined {
  if (plotId === undefined) return undefined;
  const leaseId = world.plots.find((plot) => plot.id === plotId)?.leaseId;
  return leaseId === undefined ? undefined : world.leases.find((lease) => lease.id === leaseId);
}
