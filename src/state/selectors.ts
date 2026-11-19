/**
 * Selectors — what screens read from the app state: `useApp(selectNextStep)`, `useApp(selectPlot(id))`.
 *
 * They are safe to pass straight to `useApp`: lists keep the identity of their items, so a screen
 * re-renders only when what it shows has changed; derived values (the next steps, the journey) are
 * worked out once per world and remembered.
 */
import { peekServiceDetail } from '@/data/catalog';
import { journeyOf, stationOf, type Journey, type StationKey } from '@/domain/journey';
import { collectNextSteps, deadlineOf } from '@/domain/nextstep';
import type { AppNotification, AppState, Appointment, Company, Doc, Draft, Invoice, Lease, NextStep, Pass, Persona, Plot, RequestState, World } from '@/domain/types';
import { isCatalogueReady } from './catalogue';
import { findLease, isFinished, threadOf } from './world';

export { requestView, standardClockOf, holderOf, holderNameOf, timelineRows, type RequestView, type TimelineEntry, type TimelineRow, type TimelineState } from './view';
export { useCatalogueReady } from './catalogue';

type Selector<T> = (state: AppState) => T;

/** Remembers a value derived from a world until the world, or what is known of the catalogue, changes. */
function perWorld<T>(derive: (world: World) => T): (world: World) => T {
  const cache = new WeakMap<World, { ready: boolean; value: T }>();
  return (world) => {
    const ready = isCatalogueReady();
    const hit = cache.get(world);
    if (hit && hit.ready === ready) return hit.value;
    const value = derive(world);
    cache.set(world, { ready, value });
    return value;
  };
}

/** Shared empty lists, so "nothing" is always the same nothing. */
const NO_REQUESTS: RequestState[] = [];
const NO_DOCS: Doc[] = [];

/* ───────────────────────────── session ───────────────────────────── */

export const selectPersona: Selector<Persona> = (state) => state.world.persona;
export const selectCompany: Selector<Company | null> = (state) => state.world.company;
export const selectSpeed: Selector<number> = (state) => state.demo.speed;

/* ───────────────────────────── next steps ───────────────────────────── */

const nextStepsOf = perWorld((world) => collectNextSteps(world, peekServiceDetail));

/** Everything the investor should do, most urgent first. */
export const selectNextSteps: Selector<NextStep[]> = (state) => nextStepsOf(state.world);

/** The one thing to do next, or null when nothing is needed. */
export const selectNextStep: Selector<NextStep | null> = (state) => nextStepsOf(state.world)[0] ?? null;

/* ───────────────────────────── requests ───────────────────────────── */

const activeOf = perWorld((world) =>
  world.requests
    .filter((request) => !isFinished(request))
    // Requests waiting for the investor first, then the most recently moved.
    .sort((a, b) => Number(b.status === 'needs_you') - Number(a.status === 'needs_you') || b.updatedAt - a.updatedAt),
);
const doneOf = perWorld((world) => world.requests.filter(isFinished).sort((a, b) => b.updatedAt - a.updatedAt));

/** Requests that are still moving: those waiting for the investor first. */
export const selectActiveRequests: Selector<RequestState[]> = (state) => activeOf(state.world);

/** Finished requests, the latest first. */
export const selectDoneRequests: Selector<RequestState[]> = (state) => doneOf(state.world);

/** How many requests wait for the investor (the badge on the Requests tab). */
export const selectWaitingCount: Selector<number> = (state) => state.world.requests.reduce((count, request) => count + (request.status === 'needs_you' ? 1 : 0), 0);

export const selectRequest =
  (id: string | undefined): Selector<RequestState | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.requests.find((request) => request.id === id);

/** The requests of one intent, oldest first: application → review → offer → contract → handover. */
export const selectThread =
  (requestId: string | undefined): Selector<RequestState[]> =>
  (state) => {
    const request = requestId === undefined ? undefined : state.world.requests.find((candidate) => candidate.id === requestId);
    return request ? threadOf(state.world, request) : NO_REQUESTS;
  };

export const selectRequestsOfPlot =
  (plotId: string | undefined): Selector<RequestState[]> =>
  (state) =>
    state.world.requests.filter((request) => request.plotId === plotId).sort((a, b) => b.updatedAt - a.updatedAt);

/** The date by which the investor must act on a waiting request, when there is one. */
export const selectDeadline =
  (requestId: string | undefined): Selector<number | undefined> =>
  (state) => {
    const request = requestId === undefined ? undefined : state.world.requests.find((candidate) => candidate.id === requestId);
    return request ? deadlineOf(state.world, request) : undefined;
  };

/** The documents a request has issued, in the order they were issued. */
export const selectDocsOfRequest =
  (requestId: string | undefined): Selector<Doc[]> =>
  (state) => {
    const request = requestId === undefined ? undefined : state.world.requests.find((candidate) => candidate.id === requestId);
    if (!request || !request.docIds.length) return NO_DOCS;
    return request.docIds.map((id) => state.world.docs.find((doc) => doc.id === id)).filter((doc): doc is Doc => doc !== undefined);
  };

/* ───────────────────────────── money ───────────────────────────── */

export interface Dues {
  /** Everything outstanding, in QAR. */
  total: number;
  count: number;
  /** How many of them are past their due date. */
  overdue: number;
  /** The invoice to pay first: the one due soonest. */
  next: Invoice | null;
}

/** What the investor owes right now. */
export const selectDues: Selector<Dues> = (state) => {
  let total = 0;
  let count = 0;
  let overdue = 0;
  let next: Invoice | null = null;
  for (const invoice of state.world.invoices) {
    if (invoice.status === 'paid') continue;
    total += invoice.amount;
    count++;
    if (invoice.status === 'overdue') overdue++;
    if (!next || invoice.dueAt < next.dueAt) next = invoice;
  }
  return { total, count, overdue, next };
};

const invoicesOf = perWorld((world) =>
  // Outstanding first (the soonest due on top), then history, the latest first.
  world.invoices.slice().sort((a, b) => Number(a.status === 'paid') - Number(b.status === 'paid') || (a.status === 'paid' ? (b.paidAt ?? b.issuedAt) - (a.paidAt ?? a.issuedAt) : a.dueAt - b.dueAt)),
);

export const selectInvoices: Selector<Invoice[]> = (state) => invoicesOf(state.world);

export const selectInvoice =
  (id: string | undefined): Selector<Invoice | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.invoices.find((invoice) => invoice.id === id);

/* ───────────────────────────── notifications ───────────────────────────── */

export const selectUnreadCount: Selector<number> = (state) => state.world.notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);

const notificationsOf = perWorld((world) => world.notifications.slice().sort((a, b) => b.at - a.at));

/** Notifications, the latest first. */
export const selectNotifications: Selector<AppNotification[]> = (state) => notificationsOf(state.world);

/* ───────────────────────────── journey ───────────────────────────── */

const journeyOfWorld = perWorld((world) => journeyOf(world));

/** The station the investor stands in: join, contract, build or operate. */
export const selectStation: Selector<StationKey> = (state) => stationOf(state.world);

/** The four stations with their checklists, for the journey that still has the furthest to go. */
export const selectJourney: Selector<Journey> = (state) => journeyOfWorld(state.world);

/** The journey of one plot. Not remembered: use it inside `useMemo` or for a single screen. */
export const selectJourneyOfPlot =
  (plotId: string): Selector<Journey> =>
  (state) =>
    journeyOf(state.world, plotId);

/* ───────────────────────────── plots and leases ───────────────────────────── */

export const selectPlots: Selector<Plot[]> = (state) => state.world.plots;

export const selectPlot =
  (id: string | undefined): Selector<Plot | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.plots.find((plot) => plot.id === id);

export const selectLeases: Selector<Lease[]> = (state) => state.world.leases;

/** The lease of a plot, once it is signed. */
export const selectLeaseOfPlot =
  (plotId: string | undefined): Selector<Lease | undefined> =>
  (state) =>
    findLease(state.world, state.world.plots.find((plot) => plot.id === plotId)?.leaseId);

/* ───────────────────────────── wallet ───────────────────────────── */

const docsOf = perWorld((world) => world.docs.slice().sort((a, b) => b.issuedAt - a.issuedAt));

/** Every document in the wallet, the latest first. */
export const selectDocs: Selector<Doc[]> = (state) => docsOf(state.world);

export const selectDoc =
  (id: string | undefined): Selector<Doc | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.docs.find((doc) => doc.id === id);

/** The plot a document is about: through its request, its lease, or the invoice it settles. */
export function plotIdOfDoc(world: World, doc: Doc): string | undefined {
  if (doc.requestId !== undefined) {
    const plotId = world.requests.find((request) => request.id === doc.requestId)?.plotId;
    if (plotId !== undefined) return plotId;
  }
  const lease = world.leases.find((candidate) => candidate.ref === doc.ref);
  if (lease) return lease.plotId;
  const invoice = world.invoices.find((candidate) => candidate.receiptDocId === doc.id);
  return findLease(world, invoice?.leaseId)?.plotId;
}

export const selectDocsOfPlot =
  (plotId: string | undefined): Selector<Doc[]> =>
  (state) =>
    plotId === undefined ? NO_DOCS : docsOf(state.world).filter((doc) => plotIdOfDoc(state.world, doc) === plotId);

const PASS_ORDER: Record<Pass['status'], number> = { active: 0, expired: 1, revoked: 2 };
const passesOf = perWorld((world) => world.passes.slice().sort((a, b) => PASS_ORDER[a.status] - PASS_ORDER[b.status] || b.from - a.from));

/** Gate passes: the active ones first. */
export const selectPasses: Selector<Pass[]> = (state) => passesOf(state.world);

export const selectPass =
  (id: string | undefined): Selector<Pass | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.passes.find((pass) => pass.id === id);

/* ───────────────────────────── the rest ───────────────────────────── */

const appointmentsOf = perWorld((world) => world.appointments.filter((appointment) => appointment.status === 'booked').sort((a, b) => a.at - b.at));

/** Booked appointments, the soonest first. */
export const selectAppointments: Selector<Appointment[]> = (state) => appointmentsOf(state.world);

export const selectDraft =
  (serviceId: string | undefined): Selector<Draft | undefined> =>
  (state) =>
    serviceId === undefined ? undefined : state.world.drafts[serviceId];
