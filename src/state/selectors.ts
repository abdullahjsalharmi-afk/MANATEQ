/**
 * Selectors — what screens read from the app state: `useApp(selectNextStep)`, `useApp(selectPlot(id))`.
 *
 * They are safe to pass straight to `useApp`: lists keep the identity of their items, so a screen
 * re-renders only when what it shows has changed; derived values (the next steps, the journey) are
 * worked out once per world and remembered.
 */
import { peekServiceDetail } from '@/data/catalog';
import type { ServiceId, StepAction } from '@/data/types';
import { journeyOf, stationOf, type Journey, type StationKey } from '@/domain/journey';
import { collectNextSteps, deadlineOf } from '@/domain/nextstep';
import { plotsFor } from '@/domain/plots';
import type { AppNotification, AppState, Appointment, Company, Doc, Draft, Invoice, Lease, NextStep, Pass, Persona, Plot, RequestState, TeamMember, World } from '@/domain/types';
import { isCatalogueReady } from './catalogue';
import { amountFor, renewalTerms, type RenewalTerms } from './effects';
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

/**
 * Remembers a value derived from a world and one key (a request id, a plot id) until the world, or what
 * is known of the catalogue, changes: a selector built with it returns the same array or object for the
 * same world and key, however many times a screen calls it.
 */
function perWorldBy<K, T>(derive: (world: World, key: K) => T): (world: World, key: K) => T {
  const remembered = perWorld(() => new Map<K, T>());
  return (world, key) => {
    const values = remembered(world);
    if (values.has(key)) return values.get(key) as T;
    const value = derive(world, key);
    values.set(key, value);
    return value;
  };
}

/** Shared empty lists, so "nothing" is always the same nothing. */
const NO_REQUESTS: RequestState[] = [];
const NO_DOCS: Doc[] = [];
const NO_PASSES: Pass[] = [];

const passesOfRequest = perWorld((world) => {
  const byRequest = new Map<string, Pass[]>();
  for (const pass of world.passes.slice().sort((a, b) => b.from - a.from)) {
    if (pass.requestId === undefined) continue;
    byRequest.set(pass.requestId, [...(byRequest.get(pass.requestId) ?? []), pass]);
  }
  return byRequest;
});

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

const threadOfRequest = perWorldBy((world, requestId: string): RequestState[] => {
  const request = world.requests.find((candidate) => candidate.id === requestId);
  return request ? threadOf(world, request) : NO_REQUESTS;
});

/** The requests of one intent, oldest first: application → review → offer → contract → handover. The same array for the same world. */
export const selectThread =
  (requestId: string | undefined): Selector<RequestState[]> =>
  (state) =>
    requestId === undefined ? NO_REQUESTS : threadOfRequest(state.world, requestId);

const requestsOfPlot = perWorldBy((world, plotId: string | undefined): RequestState[] => {
  const found = world.requests.filter((request) => request.plotId === plotId).sort((a, b) => b.updatedAt - a.updatedAt);
  return found.length ? found : NO_REQUESTS;
});

/** The requests about one plot, the most recently moved first. The same array for the same world. */
export const selectRequestsOfPlot =
  (plotId: string | undefined): Selector<RequestState[]> =>
  (state) =>
    requestsOfPlot(state.world, plotId);

/** The date by which the investor must act on a waiting request, when there is one. */
export const selectDeadline =
  (requestId: string | undefined): Selector<number | undefined> =>
  (state) => {
    const request = requestId === undefined ? undefined : state.world.requests.find((candidate) => candidate.id === requestId);
    return request ? deadlineOf(state.world, request) : undefined;
  };

const docsOfRequest = perWorldBy((world, requestId: string): Doc[] => {
  const request = world.requests.find((candidate) => candidate.id === requestId);
  if (!request || !request.docIds.length) return NO_DOCS;
  return request.docIds.map((id) => world.docs.find((doc) => doc.id === id)).filter((doc): doc is Doc => doc !== undefined);
});

/** The documents a request has issued, in the order they were issued. The same array for the same world. */
export const selectDocsOfRequest =
  (requestId: string | undefined): Selector<Doc[]> =>
  (state) =>
    requestId === undefined ? NO_DOCS : docsOfRequest(state.world, requestId);

/**
 * The amount the open step of a request charges, as the state will charge it: the amount fixed when the
 * step opened, else what its `pay` task asks for. Undefined when the step asks for no payment, because
 * it was already made earlier in the thread (`request.prepaidDocId`, the deposit paid with the offer).
 */
export const selectStepAmount =
  (requestId: string | undefined, action: Pick<StepAction, 'amount'> | null | undefined): Selector<number | undefined> =>
  (state) => {
    const request = requestId === undefined ? undefined : state.world.requests.find((candidate) => candidate.id === requestId);
    if (!request || !action || request.prepaidDocId !== undefined) return undefined;
    return request.amount ?? amountFor(state.world, request, action);
  };

/** The gate passes a request issued (a gate pass request, D2), the latest first. */
export const selectPassesOfRequest =
  (requestId: string | undefined): Selector<Pass[]> =>
  (state) =>
    requestId === undefined ? NO_PASSES : passesOfRequest(state.world).get(requestId) ?? NO_PASSES;

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

const duesOf = perWorld((world): Dues => {
  let total = 0;
  let count = 0;
  let overdue = 0;
  let next: Invoice | null = null;
  for (const invoice of world.invoices) {
    if (invoice.status === 'paid') continue;
    total += invoice.amount;
    count++;
    if (invoice.status === 'overdue') overdue++;
    if (!next || invoice.dueAt < next.dueAt) next = invoice;
  }
  return { total, count, overdue, next };
});

/** What the investor owes right now. The same object for the same world. */
export const selectDues: Selector<Dues> = (state) => duesOf(state.world);

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

/** Notifications not read yet; a settled one (`resolvedAt`) never counts. */
export const selectUnreadCount: Selector<number> = (state) => state.world.notifications.reduce((count, notification) => count + (notification.read || notification.resolvedAt !== undefined ? 0 : 1), 0);

const notificationsOf = perWorld((world) => world.notifications.slice().sort((a, b) => b.at - a.at));

/** Notifications, the latest first. */
export const selectNotifications: Selector<AppNotification[]> = (state) => notificationsOf(state.world);

/* ───────────────────────────── journey ───────────────────────────── */

const journeyOfWorld = perWorld((world) => journeyOf(world));

/** The station the investor stands in: join, contract, build or operate. */
export const selectStation: Selector<StationKey> = (state) => stationOf(state.world);

/** The four stations with their checklists, for the journey that still has the furthest to go. */
export const selectJourney: Selector<Journey> = (state) => journeyOfWorld(state.world);

const journeyOfPlot = perWorldBy((world, plotId: string) => journeyOf(world, plotId));

/** The journey of one plot, remembered per world: the same object until the world changes. */
export const selectJourneyOfPlot =
  (plotId: string): Selector<Journey> =>
  (state) =>
    journeyOfPlot(state.world, plotId);

/* ───────────────────────────── plots and leases ───────────────────────────── */

export const selectPlots: Selector<Plot[]> = (state) => state.world.plots;

export const selectPlot =
  (id: string | undefined): Selector<Plot | undefined> =>
  (state) =>
    id === undefined ? undefined : state.world.plots.find((plot) => plot.id === id);

export const selectLeases: Selector<Lease[]> = (state) => state.world.leases;

const plotsOfService = perWorldBy((world, serviceId: ServiceId): Plot[] => plotsFor(world, serviceId));

/**
 * The investor's plots a request of the service can be started for (`plotsFor(world, serviceId)`): for
 * the handover (A8) the leased plots not handed over yet, otherwise every plot the company holds. The
 * same array for the same world.
 */
export const selectPlotsFor =
  (serviceId: ServiceId): Selector<Plot[]> =>
  (state) =>
    plotsOfService(state.world, serviceId);

/** True when the company holds at least one plot (a plot only reserved by a running application does not count). */
export const selectHasPlots: Selector<boolean> = (state) => state.world.plots.some((plot) => plot.status !== 'reserved');

const renewalTermsOf = perWorldBy((world, requestId: string): RenewalTerms | undefined => {
  const request = world.requests.find((candidate) => candidate.id === requestId);
  return request ? renewalTerms(world, request) : undefined;
});

/**
 * What the renewal offer of a lease renewal request (B3) means for its plot: `{ plotId, until, years,
 * ratePerSqm, annualRent, firstInstalment }`, by the rule the renewal applies when it finishes. Undefined
 * for any other request. The same object for the same world.
 */
export const selectRenewalTerms =
  (requestId: string | undefined): Selector<RenewalTerms | undefined> =>
  (state) =>
    requestId === undefined ? undefined : renewalTermsOf(state.world, requestId);

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

const docsOfPlot = perWorldBy((world, plotId: string): Doc[] => {
  const found = docsOf(world).filter((doc) => plotIdOfDoc(world, doc) === plotId);
  return found.length ? found : NO_DOCS;
});

/** The documents about one plot, the latest first. The same array for the same world. */
export const selectDocsOfPlot =
  (plotId: string | undefined): Selector<Doc[]> =>
  (state) =>
    plotId === undefined ? NO_DOCS : docsOfPlot(state.world, plotId);

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

export const selectTeam: Selector<TeamMember[]> = (state) => state.world.team;

export const selectWatchedZones: Selector<string[]> = (state) => state.world.watchedZones;

export const selectDraft =
  (serviceId: string | undefined): Selector<Draft | undefined> =>
  (state) =>
    serviceId === undefined ? undefined : state.world.drafts[serviceId];
