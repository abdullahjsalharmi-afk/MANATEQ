/**
 * The journey — four stations every investor passes: join, contract, build, operate. The app shows
 * where the investor stands (the ribbon on Home) and what each station consists of (its checklist).
 *
 * A plot's station follows its status; an investor without a plot is joining. Checklist items are
 * services: an item is done when a finished request says so or when the plot is already past it,
 * current when a request is open or it is the next thing to do, upcoming otherwise.
 *
 * The services of the last station repeat for as long as the plot is held (rent, passes, fault reports,
 * inspections, renewal): they are never "done". Between requests such an item has a `standing` instead:
 * what is true of it now.
 */
import { getService } from '@/data/catalog';
import type { L10n, ServiceId } from '@/data/types';
import type { Plot, PlotStatus, RequestState, World } from './types';

export type StationKey = 'join' | 'contract' | 'build' | 'operate';
export type ItemState = 'done' | 'current' | 'upcoming';
/**
 * What holds, between requests, for a service that repeats while the plot is held: rent is `due` or `clear`
 * (read from the plot's invoices); a service the investor starts is there `on_demand`; one Manateq starts
 * (inspections, the renewal offer) is `automatic`.
 */
export type Standing = 'due' | 'clear' | 'on_demand' | 'automatic';

interface ItemDef {
  serviceId: ServiceId;
  /** From this plot status on, the item is behind the investor even with no request on record. */
  doneFrom?: PlotStatus;
  /** The earliest plot status at which the investor can start it from the app. */
  startFrom?: PlotStatus;
  /** A service that must be finished for this plot first. */
  needs?: ServiceId;
}

interface StationDef {
  key: StationKey;
  name: L10n;
  items: ItemDef[];
}

export const STATIONS: StationDef[] = [
  {
    key: 'join',
    name: { ar: 'الانضمام', en: 'Join' },
    items: [
      { serviceId: 'A2', doneFrom: 'reserved' },
      { serviceId: 'A3', doneFrom: 'reserved' },
      { serviceId: 'A4', doneFrom: 'reserved' },
      { serviceId: 'A5', doneFrom: 'reserved' },
    ],
  },
  {
    key: 'contract',
    name: { ar: 'العقد', en: 'Contract' },
    items: [
      { serviceId: 'A6', doneFrom: 'reserved' },
      { serviceId: 'A7', doneFrom: 'leased' },
      { serviceId: 'A8', doneFrom: 'handed_over', startFrom: 'leased' },
      { serviceId: 'B2', doneFrom: 'building' },
    ],
  },
  {
    key: 'build',
    name: { ar: 'البناء', en: 'Build' },
    items: [
      { serviceId: 'C1', doneFrom: 'operating', startFrom: 'handed_over' },
      { serviceId: 'C2', doneFrom: 'operating' },
      { serviceId: 'C3', doneFrom: 'operating' },
      { serviceId: 'C4', doneFrom: 'operating' },
      { serviceId: 'C6', doneFrom: 'operating', startFrom: 'building', needs: 'C2' },
      { serviceId: 'C8', doneFrom: 'operating' },
    ],
  },
  {
    key: 'operate',
    name: { ar: 'التشغيل', en: 'Operate' },
    items: [{ serviceId: 'B1' }, { serviceId: 'D2' }, { serviceId: 'D1' }, { serviceId: 'D4' }, { serviceId: 'B3' }],
  },
];

export const STATION_KEYS: StationKey[] = STATIONS.map((station) => station.key);

const STATUS_RANK: Record<PlotStatus, number> = { reserved: 0, leased: 1, handed_over: 2, building: 3, operating: 4 };

const STATION_OF_STATUS: Record<PlotStatus, StationKey> = {
  reserved: 'contract',
  leased: 'contract',
  handed_over: 'contract',
  building: 'build',
  operating: 'operate',
};

/** The services whose requests belong to an application that has no plot of its own yet. */
const APPLICATION = new Set<ServiceId>(['A4', 'A5', 'A6', 'A7']);

export interface JourneyItem {
  serviceId: ServiceId;
  /**
   * done / current / upcoming. In the station the investor stands in, the first item not done is
   * `current` even with nothing open for it: it is what comes next. Read `open` to tell "in progress"
   * (`current && open`) from "next" (`current && !open`).
   */
  state: ItemState;
  /** A request is open for this item now (moving, or waiting for the investor). */
  open: boolean;
  /** The request behind the state: the open one, or the latest finished one. */
  requestId?: string;
  /** The latest request for this item was withdrawn or closed without its outcome, and nothing newer exists. */
  stoppedRequestId?: string;
  /** The investor can start this service now. */
  canStart: boolean;
  /**
   * Set for a repeating service of the last station while nothing is open for it and no finished request
   * stands behind it: what is true of it now. Such an item is never "done" and never "next".
   */
  standing?: Standing;
}

export interface JourneyStation {
  key: StationKey;
  name: L10n;
  /** Done when the investor is past it, current when they stand in it, upcoming otherwise. */
  state: ItemState;
  items: JourneyItem[];
}

export interface Journey {
  station: StationKey;
  /** The plot the journey is about, or null while the investor has none. */
  plotId: string | null;
  stations: JourneyStation[];
}

const isOpen = (request: RequestState): boolean => request.status === 'active' || request.status === 'needs_you';
const atLeast = (plot: Plot | undefined, status: PlotStatus | undefined): boolean => plot !== undefined && status !== undefined && STATUS_RANK[plot.status] >= STATUS_RANK[status];

/** Requests of an application that has not been given a plot record yet. */
function applicationRequests(world: World): RequestState[] {
  const owned = new Set(world.plots.map((plot) => plot.id));
  return world.requests.filter((request) => APPLICATION.has(request.serviceId) && !(request.plotId !== undefined && owned.has(request.plotId)));
}

/**
 * The plot whose journey matters most: the one furthest from operating (the most recent of them).
 * Undefined while the investor has no plot, or while a new application is open.
 */
export function focusPlot(world: World): Plot | undefined {
  if (applicationRequests(world).some(isOpen)) return undefined;
  let focus: Plot | undefined;
  for (const plot of world.plots) {
    if (!focus || STATUS_RANK[plot.status] <= STATUS_RANK[focus.status]) focus = plot;
  }
  return focus;
}

function resolvePlot(world: World, plotId?: string): Plot | undefined {
  return plotId === undefined ? focusPlot(world) : world.plots.find((plot) => plot.id === plotId);
}

/**
 * Where the investor stands. With a `plotId`, the station of that plot; without one, the station of
 * the journey that still has the furthest to go. No plot yet: join.
 */
export function stationOf(world: World, plotId?: string): StationKey {
  const plot = resolvePlot(world, plotId);
  return plot ? STATION_OF_STATUS[plot.status] : 'join';
}

/** Rent, read from the invoices of the plot's lease: something is unpaid, everything is paid, or nothing was billed yet. */
function rentStanding(world: World, plot: Plot): Standing | undefined {
  const invoices = world.invoices.filter((invoice) => invoice.leaseId !== undefined && invoice.leaseId === plot.leaseId);
  if (invoices.some((invoice) => invoice.status !== 'paid')) return 'due';
  return invoices.length > 0 ? 'clear' : undefined;
}

/** The stations with their checklists, for one plot or for the investor's current journey. */
export function journeyOf(world: World, plotId?: string): Journey {
  const plot = resolvePlot(world, plotId);
  const station = plot ? STATION_OF_STATUS[plot.status] : 'join';
  const stationIndex = STATION_KEYS.indexOf(station);
  const scope = plot ? world.requests.filter((request) => request.plotId === plot.id) : applicationRequests(world);
  const latest = (serviceId: ServiceId, wanted: (request: RequestState) => boolean): RequestState | undefined => {
    let found: RequestState | undefined;
    for (const request of scope) {
      if (request.serviceId === serviceId && wanted(request) && (!found || request.createdAt >= found.createdAt)) found = request;
    }
    return found;
  };
  const finished = (serviceId: ServiceId): boolean => latest(serviceId, (request) => request.status === 'done') !== undefined;

  const stations = STATIONS.map((definition, index): JourneyStation => {
    const items = definition.items.map((item): JourneyItem => {
      const open = latest(item.serviceId, isOpen);
      const done = latest(item.serviceId, (request) => request.status === 'done');
      let state: ItemState = 'upcoming';
      if (open) state = 'current';
      else if (done || atLeast(plot, item.doneFrom)) state = 'done';
      else if (item.serviceId === 'A2' && world.eligibility) state = 'done';
      else if (item.serviceId === 'A3' && world.company) state = 'done';

      // The last station never ends: its services repeat. With nothing open and no finished request behind
      // it, an item says what is true of it now instead of "done" or "next".
      let standing: Standing | undefined;
      if (definition.key === 'operate' && plot && !open) {
        // Rent is billed from the signature of the lease on, by itself.
        if (item.serviceId === 'B1') standing = rentStanding(world, plot) ?? (atLeast(plot, 'leased') ? 'automatic' : undefined);
        else if (!done && plot.status === 'operating') standing = getService(item.serviceId)?.startable ? 'on_demand' : 'automatic';
        if (standing === 'due') state = 'current';
        else if (standing === 'clear') state = 'done';
        else if (standing) state = 'upcoming';
      }

      const requestId = standing ? undefined : (open ?? done)?.id;
      const newest = latest(item.serviceId, () => true);
      const stoppedRequestId = newest?.status === 'stopped' ? newest.id : undefined;
      return {
        serviceId: item.serviceId,
        state,
        open: open !== undefined,
        ...(requestId ? { requestId } : {}),
        ...(stoppedRequestId ? { stoppedRequestId } : {}),
        canStart: false,
        ...(standing ? { standing } : {}),
      };
    });

    // In the station the investor stands in, the first thing not yet done is what comes next. A repeating
    // service that is simply available is not "next".
    if (index === stationIndex) {
      const next = items.find((item) => item.state !== 'done' && item.standing === undefined);
      if (next && next.state === 'upcoming') next.state = 'current';
    }

    items.forEach((item, itemIndex) => {
      const definitionOfItem = definition.items[itemIndex] as ItemDef;
      if (item.state === 'done' || latest(item.serviceId, isOpen) || !getService(item.serviceId)?.startable) return;
      if (definitionOfItem.needs && !finished(definitionOfItem.needs)) return;
      if (definitionOfItem.startFrom) item.canStart = atLeast(plot, definitionOfItem.startFrom);
      else if (!plot && definition.key === 'join') {
        // The eligibility check opens the journey; the application follows a result that is not a refusal.
        if (item.serviceId === 'A2') item.canStart = true;
        if (item.serviceId === 'A4') item.canStart = world.eligibility !== null && world.eligibility.verdict !== 'not_targeted';
      }
    });

    const state: ItemState = index < stationIndex ? 'done' : index === stationIndex ? 'current' : 'upcoming';
    return { key: definition.key, name: definition.name, state, items };
  });

  return { station, plotId: plot?.id ?? null, stations };
}

/** The checklist of one station. */
export function checklist(world: World, station: StationKey, plotId?: string): JourneyItem[] {
  return journeyOf(world, plotId).stations.find((entry) => entry.key === station)?.items ?? [];
}
