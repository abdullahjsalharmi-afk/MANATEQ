import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail } from '@/data/types';
import { plotsFor } from '@/domain/plots';
import type { RequestState } from '@/domain/types';
import { findStep } from '@/domain/workflow';
import {
  actOnRequest,
  bookAppointment,
  cancelAppointment,
  cancelRequest,
  clearDraft,
  enterAs,
  fastForwardRequest,
  issuePass,
  markAllRead,
  markRead,
  payInvoice,
  resetDemo,
  revokePass,
  saveDraft,
  saveEligibility,
  setDelegated,
  setLang,
  setNotifications,
  setSpeed,
  setTextSize,
  setTheme,
  signOut,
  startRequest,
  tick,
  toggleWatchZone,
} from '@/state/actions';
import {
  selectActiveRequests,
  selectAppointments,
  selectDocs,
  selectDocsOfPlot,
  selectDocsOfRequest,
  selectDoneRequests,
  selectDues,
  selectInvoices,
  selectJourney,
  selectLeaseOfPlot,
  selectNextStep,
  selectNextSteps,
  selectNotifications,
  selectPasses,
  selectPlot,
  selectPlots,
  selectRequest,
  selectStation,
  selectThread,
  selectUnreadCount,
  selectWaitingCount,
} from '@/state/selectors';
import { appStore, getState, resetEverything } from '@/state/store';
import { holdOf } from '@/state/types';

/** Display text keeps codes and amounts whole with invisible joiners and no-break spaces; compare it as plain text. */
const plain = (text: string | undefined): string | undefined => text?.replace(/\u2060/g, '').replace(/\u00A0/g, ' ');

const DAY = 86_400_000;
const START = new Date(2026, 10, 19, 9, 30).getTime();

beforeAll(async () => {
  await loadAllServiceDetails();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  resetEverything();
});

afterEach(() => {
  vi.useRealTimers();
});

const world = () => getState().world;
const detailOf = (request: RequestState): ServiceDetail => peekServiceDetail(request.serviceId) as ServiceDetail;
const requestOf = (serviceId: string): RequestState | undefined => world().requests.find((request) => request.serviceId === serviceId);
const byId = (id: string): RequestState => world().requests.find((request) => request.id === id) as RequestState;
const actionOf = (request: RequestState) => detailOf(request).actions.find((action) => action.step === request.current);

/** Lets demo time pass, half a second at a time, until `done` says so. The app shell ticks the same way. */
function runUntil(done: () => boolean, maxSeconds = 300): void {
  for (let i = 0; i < maxSeconds * 2 && !done(); i++) {
    vi.advanceTimersByTime(500);
    tick(Date.now());
  }
  expect(done(), 'the simulation did not get there in time').toBe(true);
}

/** Plays the investor too: completes whatever any request asks for, until `done` says so. */
function playUntil(done: () => boolean, maxSeconds = 600): void {
  for (let i = 0; i < maxSeconds * 2 && !done(); i++) {
    for (const request of world().requests.filter((candidate) => candidate.status === 'needs_you')) actOnRequest(request.id, answers(request));
    vi.advanceTimersByTime(500);
    tick(Date.now());
  }
  expect(done(), 'the simulation did not get there in time').toBe(true);
}

const answers = (request: RequestState) => ({ files: [{ name: 'document.pdf', size: 1000 }], form: { reference: 'REF-DEMO-1' }, rating: 5, choice: actionOf(request)?.options?.[0]?.value ?? 'yes' });

/** Takes one request to its end: completes each step it asks of the investor, and lets time pass in between. */
function finish(id: string, maxSeconds = 300): void {
  for (let i = 0; i < maxSeconds * 2 && byId(id).status !== 'done'; i++) {
    if (byId(id).status === 'needs_you') actOnRequest(id, answers(byId(id)));
    else {
      vi.advanceTimersByTime(500);
      tick(Date.now());
    }
  }
  expect(byId(id).status, `${byId(id).serviceId} did not finish`).toBe('done');
}

describe('settings', () => {
  it('changes one setting at a time and leaves the state alone when nothing changes', () => {
    setLang('en');
    setTheme('dark');
    setTextSize(3);
    setNotifications(false);
    expect(getState().settings).toMatchObject({ lang: 'en', theme: 'dark', textSize: 3, notifications: false });
    const before = getState();
    setLang('en');
    setTheme('dark');
    setTextSize(3);
    setNotifications(false);
    expect(getState()).toBe(before);
  });
});

describe('session', () => {
  it('enters as a demo profile with its world seeded now', () => {
    enterAs('tenant');
    expect(getState().settings.onboarded).toBe(true);
    expect(world().persona).toBe('tenant');
    expect(world().plots).toHaveLength(3);
    expect(world().requests.length).toBeGreaterThan(5);
    expect(selectDues(getState()).next?.dueAt).toBe(START + 5 * DAY);
  });

  it('signs out to the welcome screen and keeps the settings', () => {
    setLang('en');
    enterAs('tenant');
    signOut();
    expect(getState().settings).toMatchObject({ onboarded: false, lang: 'en' });
    expect(world().persona).toBe('guest');
    expect(world().plots).toEqual([]);
  });

  it('resets the demo to the beginning of the same profile', () => {
    enterAs('tenant');
    const invoice = selectDues(getState()).next;
    payInvoice(invoice?.id ?? '');
    setSpeed(4);
    expect(selectDues(getState()).count).toBe(0);
    vi.setSystemTime(START + 3 * DAY);
    resetDemo();
    expect(world().persona).toBe('tenant');
    expect(selectDues(getState()).count).toBe(1);
    expect(selectDues(getState()).next?.dueAt).toBe(START + 3 * DAY + 5 * DAY);
    expect(getState().demo.speed).toBe(1);
  });
});

describe('the prospect journey, end to end', () => {
  it('goes from the eligibility check to a handed-over plot', () => {
    enterAs('prospect');
    expect(selectStation(getState())).toBe('join');
    // The demo prospect has checked once already; the application is next. A new check replaces that result.
    expect(world().eligibility).not.toBeNull();
    expect(selectNextStep(getState())).toMatchObject({ kind: 'start_service', route: '/start/A4' });

    saveEligibility({ activityCode: 'ACT-101', solution: 'logistics', areaSqm: 4000, verdict: 'targeted', zoneCodes: ['AW', 'BA'] });
    expect(world().eligibility?.at).toBe(START);
    expect(selectNextStep(getState())).toMatchObject({ kind: 'start_service', route: '/start/A4' });

    // The application: one sitting — details, documents and the preferred plot — then it is submitted.
    const picked = plotsFor('AW').find((cell) => cell.status === 'available');
    expect(picked).toBeDefined();
    if (!picked) return;
    saveDraft('A4', { area: 4000 }, 1);
    expect(selectNextStep(getState())?.id).toBe('draft:A4');
    const application = startRequest('A4', { detailsConfirmed: true, area: 4000, businessPlan: { name: 'plan.pdf', size: 1 }, financials: { name: 'statements.pdf', size: 1 } }, { plotId: picked.id, zoneCode: 'AW' });
    expect(world().drafts.A4).toBeUndefined();
    expect(byId(application)).toMatchObject({ serviceId: 'A4', threadId: application, plotId: picked.id, zoneCode: 'AW', createdAt: START });
    expect(byId(application).ref).toMatch(/^MQ-2611-\d{4}$/);
    // Nothing is asked twice: the request is moving, and nothing is needed from the investor.
    expect(byId(application).status).toBe('active');
    expect(selectNextSteps(getState())).toEqual([]);

    // Review and offer follow by themselves; the offer waits for acceptance and the deposit.
    runUntil(() => requestOf('A6')?.status === 'needs_you');
    expect(byId(application).status).toBe('done');
    expect(byId(application).investorMs).toBe(0);
    const review = requestOf('A5') as RequestState;
    const offer = requestOf('A6') as RequestState;
    expect(review).toMatchObject({ status: 'done', parentId: application, threadId: application, plotId: picked.id });
    expect(offer).toMatchObject({ parentId: review.id, threadId: application });
    const offerTasks = detailOf(offer).actions.flatMap((action) => action.flow);
    expect(offerTasks).toEqual(expect.arrayContaining(['accept', 'pay']));
    const annualRent = 15 * picked.areaSqm;
    const quarter = Math.round(annualRent / 4);
    // The amount is fixed and shown before the investor pays.
    if (actionOf(offer)?.flow.includes('pay')) expect(offer.amount).toBe(quarter);
    expect(selectNextStep(getState())).toMatchObject({ kind: 'request_action', route: `/requests/${offer.id}` });
    expect(selectNextStep(getState())?.dueAt).toBeGreaterThan(START + 13 * DAY);
    expect(selectWaitingCount(getState())).toBe(1);
    expect(world().notifications.some((n) => n.kind === 'action' && n.route === `/requests/${offer.id}` && !n.read)).toBe(true);
    expect(world().notifications.some((n) => n.kind === 'done' && n.route === `/requests/${application}`)).toBe(true);
    expect(world().plots).toEqual([]);
    expect(selectStation(getState())).toBe('join');

    // Accept and pay: a paid invoice and its receipt, the moment the investor pays.
    expect(actOnRequest(offer.id)).toBe(true);
    finish(offer.id);
    const deposit = world().invoices.find((invoice) => invoice.requestId === offer.id);
    expect(deposit).toMatchObject({ status: 'paid', amount: quarter });
    expect(deposit?.paidAt).toBe(deposit?.issuedAt);
    const depositReceipt = world().docs.find((doc) => doc.id === deposit?.receiptDocId);
    expect(depositReceipt).toMatchObject({ kind: 'receipt', requestId: offer.id, issuedAt: deposit?.paidAt });
    expect(byId(offer.id).docIds).toContain(depositReceipt?.id);
    expect(byId(offer.id).form.acceptedAt).toBeGreaterThanOrEqual(START);
    expect(actOnRequest(offer.id)).toBe(false);

    // The contract follows; the plot is held meanwhile.
    runUntil(() => requestOf('A7')?.status === 'needs_you');
    expect(selectPlot(picked.id)(getState())).toMatchObject({ number: picked.id, zoneCode: 'AW', areaSqm: picked.areaSqm, solution: 'logistics', status: 'reserved' });
    expect(selectStation(getState())).toBe('contract');
    expect(world().docs.some((doc) => doc.kind === 'offer' && doc.requestId === offer.id)).toBe(true);
    const contract = requestOf('A7') as RequestState;
    expect(detailOf(contract).actions.flatMap((action) => action.flow)).toContain('sign');
    expect(world().leases).toEqual([]);

    // Sign: Manateq countersigns, the contract is registered, billing starts.
    finish(contract.id);
    expect(byId(contract.id).form.signedAt).toBeGreaterThanOrEqual(START);
    const lease = selectLeaseOfPlot(picked.id)(getState());
    expect(lease).toMatchObject({ plotId: picked.id, ratePerSqmYear: 15, annualRent, status: 'active' });
    expect(lease?.ref).toMatch(/^LC-2026-\d{4}$/);
    expect(new Date(lease?.endsAt ?? 0).getFullYear()).toBe(2051);
    expect(selectPlot(picked.id)(getState())).toMatchObject({ status: 'leased', leaseId: lease?.id });
    const contractDoc = world().docs.find((doc) => doc.kind === 'contract');
    expect(contractDoc).toMatchObject({ ref: lease?.ref, signed: true, requestId: contract.id, serviceId: 'A7' });
    expect(selectDocsOfRequest(contract.id)(getState())).toEqual([contractDoc]);
    const firstRent = world().invoices.find((invoice) => invoice.leaseId === lease?.id && invoice.status === 'due');
    expect(firstRent).toMatchObject({ amount: quarter, requestId: contract.id });
    expect((firstRent?.dueAt ?? 0) - (firstRent?.issuedAt ?? 0)).toBe(30 * DAY);
    expect(selectDues(getState())).toMatchObject({ total: firstRent?.amount, count: 1, overdue: 0, next: firstRent });

    // What comes next is offered, not hidden: pay the first rent, book the handover.
    const routes = selectNextSteps(getState()).map((step) => step.route);
    expect(routes).toContain(`/account/payments/${firstRent?.id}`);
    expect(routes).toContain(`/start/A8?plot=${picked.id}`);
    expect(requestOf('B2')).toMatchObject({ parentId: contract.id, threadId: application });

    // Handover: booked by the investor, done on site, and the utilities request opens by itself.
    const handover = startRequest('A8', { slot: Date.now() + DAY }, { plotId: picked.id, threadId: application, parentId: contract.id });
    finish(handover);
    expect(selectPlot(picked.id)(getState())?.status).toBe('handed_over');
    expect(selectDocsOfRequest(handover)(getState()).map((doc) => doc.kind)).toContain('certificate');
    expect(world().requests.filter((request) => request.serviceId === 'C4')).toHaveLength(1);
    expect(requestOf('C4')).toMatchObject({ parentId: handover, plotId: picked.id, threadId: application });

    // One thread from application to utilities, in order.
    const thread = selectThread(handover)(getState());
    expect(thread.map((request) => request.serviceId).slice(0, 4)).toEqual(['A4', 'A5', 'A6', 'A7']);
    expect(thread.map((request) => request.serviceId)).toEqual(expect.arrayContaining(['A8', 'B2', 'C4']));
    expect(thread.map((request) => request.createdAt)).toEqual(thread.map((request) => request.createdAt).sort((a, b) => a - b));

    // Every finished step of the way told the investor.
    const done = world().notifications.filter((n) => n.kind === 'done').map((n) => n.route);
    for (const id of [application, review.id, offer.id, contract.id, handover]) expect(done).toContain(`/requests/${id}`);
    expect(world().notifications.filter((n) => n.kind === 'action').length).toBeGreaterThanOrEqual(2);
    expect(selectUnreadCount(getState())).toBe(world().notifications.length);

    // Handed over, not yet building: the design submission is the next step of the journey.
    expect(selectStation(getState())).toBe('contract');
    expect(selectNextSteps(getState()).map((step) => step.route)).toContain(`/start/C1?plot=${picked.id}`);
    const design = startRequest('C1', { plot: picked.id, drawings: { name: 'drawings.pdf' }, calculations: { name: 'calculations.pdf' } });
    expect(byId(design).plotId).toBe(picked.id);
    expect(selectPlot(picked.id)(getState())?.status).toBe('building');
    expect(selectStation(getState())).toBe('build');
    finish(design);
    expect(selectDocsOfPlot(picked.id)(getState()).map((doc) => doc.kind)).toEqual(expect.arrayContaining(['noc', 'contract', 'certificate', 'receipt', 'offer']));

    // The wallet and the lists agree with the world.
    expect(selectDocs(getState())).toHaveLength(world().docs.length);
    expect(selectDoneRequests(getState()).length + selectActiveRequests(getState()).length).toBe(world().requests.length);
    expect(selectJourney(getState()).plotId).toBe(picked.id);
  });

  it('asks for the documents and the plot when the application starts without them', () => {
    enterAs('prospect');
    const application = startRequest('A4', { detailsConfirmed: true, area: 4000 });
    runUntil(() => byId(application).status === 'needs_you', 60);
    expect(actionOf(byId(application))).toBeDefined();
    expect(selectNextStep(getState())?.route).toBe(`/requests/${application}`);
    actOnRequest(application, { files: [{ name: 'plan.pdf' }, { name: 'statements.pdf' }] });
    expect(Object.values(byId(application).form)).toContainEqual({ name: 'plan.pdf' });
    finish(application);
    expect(requestOf('A5')).toBeDefined();
  });

  it('gives the held plot back when the investor withdraws before the lease exists', () => {
    enterAs('prospect');
    const picked = plotsFor('BA').find((cell) => cell.status === 'available');
    if (!picked) return;
    startRequest('A4', {}, { plotId: picked.id, zoneCode: 'BA' });
    playUntil(() => requestOf('A7')?.status === 'needs_you');
    expect(world().plots.map((plot) => plot.status)).toEqual(['reserved']);
    const contract = requestOf('A7') as RequestState;
    cancelRequest(contract.id);
    expect(byId(contract.id)).toMatchObject({ status: 'stopped', current: null });
    expect(world().plots).toEqual([]);
    expect(selectStation(getState())).toBe('join');
    const before = getState();
    cancelRequest(contract.id);
    tick(Date.now() + 60_000);
    expect(getState()).toBe(before);
  });
});

describe('invoices', () => {
  it('pays an invoice once and files its receipt', () => {
    enterAs('tenant');
    const dues = selectDues(getState());
    const invoice = dues.next;
    expect(dues).toMatchObject({ total: 37_500, count: 1, overdue: 0 });
    expect(selectNextStep(getState())).toMatchObject({ kind: 'invoice', route: `/account/payments/${invoice?.id}` });
    const docsBefore = world().docs.length;

    vi.setSystemTime(START + 60_000);
    const receiptId = payInvoice(invoice?.id ?? '');
    expect(receiptId).not.toBeNull();
    const paid = world().invoices.find((candidate) => candidate.id === invoice?.id);
    expect(paid).toMatchObject({ status: 'paid', paidAt: START + 60_000, receiptDocId: receiptId });
    const receipt = world().docs.find((doc) => doc.id === receiptId);
    expect(receipt).toMatchObject({ kind: 'receipt', ref: invoice?.ref.replace('INV-', 'RCP-'), issuedAt: START + 60_000 });
    expect(receipt?.verifyCode).toMatch(/^TSD-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(world().docs).toHaveLength(docsBefore + 1);
    expect(selectDocsOfPlot('BA-121')(getState())[0]).toBe(receipt);
    expect(selectDues(getState())).toEqual({ total: 0, count: 0, overdue: 0, next: null });
    expect(selectNextStep(getState())?.kind).toBe('renewal');
    expect(selectInvoices(getState()).every((candidate) => candidate.status === 'paid')).toBe(true);

    // Paying again, or paying something that does not exist, changes nothing.
    const before = getState();
    expect(payInvoice(invoice?.id ?? '')).toBeNull();
    expect(payInvoice('no-such-invoice')).toBeNull();
    expect(getState()).toBe(before);
  });

  it('marks an unpaid invoice overdue when its day has passed, and says so', () => {
    enterAs('tenant');
    setSpeed(0);
    const invoice = selectDues(getState()).next;
    vi.setSystemTime(START + 5 * DAY + 60_000);
    tick(Date.now());
    // Paused: nothing happens, not even the calendar.
    expect(selectDues(getState()).overdue).toBe(0);
    setSpeed(1);
    tick(Date.now());
    expect(selectDues(getState())).toMatchObject({ overdue: 1, count: 1 });
    expect(selectNextStep(getState())).toMatchObject({ kind: 'invoice', id: `invoice:${invoice?.id}` });
    expect(selectNotifications(getState()).some((n) => n.kind === 'action' && n.route === `/account/payments/${invoice?.id}` && n.at === invoice?.dueAt)).toBe(true);
    // Once is enough.
    const count = world().notifications.length;
    tick(Date.now() + 1000);
    expect(world().notifications).toHaveLength(count);
  });
});

describe('the tenant’s renewal', () => {
  it('is accepted, signed and paid, and the lease runs for another year', () => {
    enterAs('tenant');
    const renewal = requestOf('B3') as RequestState;
    const yard = selectLeaseOfPlot('AK-113')(getState());
    expect(renewal.status).toBe('needs_you');
    expect(yard?.status).toBe('expiring');
    expect(selectNextSteps(getState()).find((step) => step.kind === 'renewal')).toMatchObject({ route: `/requests/${renewal.id}`, dueAt: yard?.endsAt });

    expect(detailOf(renewal).actions.flatMap((action) => action.flow)).toEqual(expect.arrayContaining(['accept', 'sign', 'pay']));
    finish(renewal.id);
    const payment = world().invoices.find((invoice) => invoice.requestId === renewal.id);
    expect(payment).toMatchObject({ status: 'paid', amount: 50_000, leaseId: yard?.id });
    expect(byId(renewal.id).form.acceptedAt).toBeGreaterThanOrEqual(START);
    expect(byId(renewal.id).form.signedAt).toBeGreaterThanOrEqual(START);

    const renewed = selectLeaseOfPlot('AK-113')(getState());
    expect(renewed?.status).toBe('active');
    expect(new Date(renewed?.endsAt ?? 0).getFullYear()).toBe(new Date(yard?.endsAt ?? 0).getFullYear() + 1);
    expect(Math.round(((renewed?.endsAt ?? 0) - (yard?.endsAt ?? 0)) / DAY)).toBe(365);
    const docs = selectDocsOfRequest(renewal.id)(getState());
    expect(docs.map((doc) => doc.kind).sort()).toEqual(['contract', 'receipt']);
    expect(docs.find((doc) => doc.kind === 'contract')).toMatchObject({ signed: true, serviceId: 'B3' });
    expect(plain(docs.find((doc) => doc.kind === 'contract')?.title.en)).toBe('Lease renewal addendum · AK-113');
    expect(selectNextSteps(getState()).some((step) => step.kind === 'renewal')).toBe(false);

    // The renewal does not open again while the new term is far from its end.
    tick(Date.now() + 10_000);
    expect(world().requests.filter((request) => request.serviceId === 'B3')).toHaveLength(1);
  });
});

describe('requests in motion', () => {
  it('fast-forwards one step of a request that someone else holds', () => {
    enterAs('tenant');
    const permit = requestOf('C2') as RequestState;
    expect(holdOf(permit)).toBeGreaterThan(START);
    tick(START + 30_000);
    expect(byId(permit.id)).toBe(permit);

    vi.setSystemTime(START + 60_000);
    fastForwardRequest(permit.id);
    const moved = byId(permit.id);
    expect(moved.visits).toHaveLength(permit.visits.length + 1);
    expect(moved.visits[permit.visits.length - 1]?.doneAt).toBe(START + 60_000);
    expect(holdOf(moved)).toBeUndefined();
    runUntil(() => byId(permit.id).status === 'done', 120);
    expect(world().notifications.some((n) => n.kind === 'done' && n.route === `/requests/${permit.id}`)).toBe(true);

    // The investor's own step is not something to fast-forward.
    const renewal = requestOf('B3') as RequestState;
    const before = getState();
    fastForwardRequest(renewal.id);
    fastForwardRequest('no-such-request');
    expect(getState()).toBe(before);
  });

  it('takes a maintenance report from the photo to the rating', () => {
    enterAs('tenant');
    const report = startRequest('D1', { category: 'roads', photo: { name: 'pothole.jpg' }, location: 'BA-121' }, { plotId: 'BA-121' });
    expect(byId(report).status).toBe('active');
    runUntil(() => byId(report).status === 'needs_you' && actionOf(byId(report))?.flow.includes('rate') === true, 180);
    const field = byId(report).visits.some((visit) => findStep(detailOf(byId(report)).workflow, visit.step)?.lane === 'field');
    expect(field).toBe(true);
    actOnRequest(report, { rating: { stars: 4, comment: '  Quick fix  ' } });
    expect(byId(report).rating).toEqual({ stars: 4, comment: 'Quick fix' });
    runUntil(() => byId(report).status === 'done', 60);
    // The half second it took to rate is the investor's, not the service's.
    expect(byId(report).investorMs).toBeGreaterThanOrEqual(0);
    expect(byId(report).investorMs).toBeLessThan(1000);
  });

  it('pauses and resumes', () => {
    enterAs('tenant');
    const report = startRequest('D1', { category: 'roads', photo: { name: 'pothole.jpg' }, location: 'BA-121' }, { plotId: 'BA-121' });
    setSpeed(0);
    const paused = byId(report);
    vi.setSystemTime(START + 10 * 60_000);
    tick(Date.now());
    expect(byId(report)).toBe(paused);
    // Back from the pause, the open step takes its time from now: nothing jumps.
    setSpeed(1);
    tick(Date.now());
    expect(byId(report).visits).toHaveLength(paused.visits.length);
    expect(byId(report).visits[paused.visits.length - 1]?.enteredAt).toBe(START + 10 * 60_000);
    runUntil(() => byId(report).status === 'needs_you', 120);
  });

  it('runs faster at a higher speed', () => {
    enterAs('tenant');
    const slow = startRequest('B8', { docType: 'statement' }, { plotId: 'BA-121' });
    runUntil(() => byId(slow).status === 'done', 120);
    const normal = Date.now() - START;
    setSpeed(8);
    const begun = Date.now();
    const fast = startRequest('B8', { docType: 'statement' }, { plotId: 'BA-121' });
    runUntil(() => byId(fast).status === 'done', 120);
    expect(Date.now() - begun).toBeLessThan(normal / 3);
    expect(selectDocsOfRequest(fast)(getState())[0]?.kind).toBe('statement');
  });
});

describe('the simulation tick', () => {
  it('is idempotent and returns the very same state when nothing is due', () => {
    enterAs('tenant');
    tick(START);
    const settled = getState();
    let notified = 0;
    const stop = appStore.subscribe(() => notified++);
    tick(START);
    tick(START + 500);
    tick(START + 30_000);
    stop();
    expect(getState()).toBe(settled);
    expect(notified).toBe(0);
  });

  it('gives lists that keep their identity while the world does not change', () => {
    enterAs('tenant');
    const state = getState();
    expect(selectActiveRequests(state)).toBe(selectActiveRequests(state));
    expect(selectNextSteps(state)).toBe(selectNextSteps(state));
    expect(selectDocs(state)).toBe(selectDocs(state));
    expect(selectJourney(state)).toBe(selectJourney(state));
    expect(selectPlots(state)).toBe(state.world.plots);
    // Requests waiting for the investor come first.
    expect(selectActiveRequests(state)[0]?.status).toBe('needs_you');
    expect(selectActiveRequests(state).map((request) => request.status)).not.toContain('done');
    expect(selectDoneRequests(state).every((request) => request.status === 'done' || request.status === 'stopped')).toBe(true);
    expect(selectRequest(undefined)(state)).toBeUndefined();
    expect(selectThread('no-such-request')(state)).toEqual([]);
  });
});

describe('gate passes', () => {
  it('issues and revokes a pass', () => {
    enterAs('tenant');
    const id = issuePass({ kind: 'vehicle', holder: 'Delivery van', idOrPlate: '000000', plotId: 'BA-121', from: START, to: START + DAY });
    const pass = world().passes.find((candidate) => candidate.id === id);
    expect(pass).toMatchObject({ status: 'active', kind: 'vehicle', plotId: 'BA-121' });
    expect(pass?.code).toMatch(/^GP-[0-9A-Z]{6}$/);
    expect(selectPasses(getState())[0]?.status).toBe('active');
    revokePass(id);
    expect(world().passes.find((candidate) => candidate.id === id)?.status).toBe('revoked');
    const before = getState();
    revokePass(id);
    expect(getState()).toBe(before);
    // Active passes first, revoked last.
    expect(selectPasses(getState()).map((candidate) => candidate.status)).toEqual(['active', 'expired', 'revoked']);
  });

  it('expires a pass when its time is up', () => {
    enterAs('tenant');
    const id = issuePass({ kind: 'visitor', holder: 'Guest', plotId: 'BA-121', from: START, to: START + 60_000 });
    tick(START + 61_000);
    expect(world().passes.find((candidate) => candidate.id === id)?.status).toBe('expired');
  });

  it('issues the pass of a gate-pass request exactly once', () => {
    enterAs('tenant');
    const before = world().passes.length;
    const request = startRequest('D2', { passType: 'visitor', visitor: { name: 'Demo guest', phone: '0000' }, validFrom: '2026-11-20', validTo: '2026-11-20', plot: 'AW-116' });
    expect(byId(request).plotId).toBe('AW-116');
    playUntil(() => byId(request).status === 'done', 120);
    expect(world().passes).toHaveLength(before + 1);
    const pass = world().passes[world().passes.length - 1];
    expect(pass).toMatchObject({ kind: 'visitor', holder: 'Demo guest', plotId: 'AW-116', status: 'active' });
    expect(pass?.from).toBe(new Date(2026, 10, 20).getTime());
    expect(pass?.to).toBe(new Date(2026, 10, 21).getTime() - 1);
    tick(Date.now() + 5000);
    expect(world().passes).toHaveLength(before + 1);
  });
});

describe('notifications, appointments, drafts and the rest', () => {
  it('marks notifications read', () => {
    enterAs('tenant');
    const unread = selectUnreadCount(getState());
    expect(unread).toBeGreaterThan(1);
    const first = selectNotifications(getState()).find((n) => !n.read);
    markRead(first?.id ?? '');
    expect(selectUnreadCount(getState())).toBe(unread - 1);
    const once = getState();
    markRead(first?.id ?? '');
    expect(getState()).toBe(once);
    markAllRead();
    expect(selectUnreadCount(getState())).toBe(0);
    const twice = getState();
    markAllRead();
    expect(getState()).toBe(twice);
    // The latest first.
    const times = selectNotifications(getState()).map((n) => n.at);
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('books and cancels an appointment', () => {
    enterAs('prospect');
    const id = bookAppointment({ at: START + 2 * DAY, topic: { ar: 'استفسار', en: 'Enquiry' }, channel: 'video' });
    expect(selectAppointments(getState())).toMatchObject([{ id, status: 'booked', channel: 'video' }]);
    cancelAppointment(id);
    expect(selectAppointments(getState())).toEqual([]);
    expect(world().appointments[0]?.status).toBe('cancelled');
  });

  it('keeps one draft per service', () => {
    enterAs('prospect');
    saveDraft('E1', { request: 'Hello' });
    saveDraft({ serviceId: 'E1', form: { request: 'Hello again' }, page: 2 });
    expect(world().drafts.E1).toMatchObject({ serviceId: 'E1', form: { request: 'Hello again' }, page: 2, savedAt: START });
    expect(Object.keys(world().drafts)).toEqual(['E1']);
    clearDraft('E1');
    expect(world().drafts).toEqual({});
    const before = getState();
    clearDraft('E1');
    expect(getState()).toBe(before);
  });

  it('follows zones and delegates team members', () => {
    enterAs('tenant');
    toggleWatchZone('BA');
    expect(world().watchedZones).toEqual(['AW', 'BA']);
    toggleWatchZone('AW');
    expect(world().watchedZones).toEqual(['BA']);

    const operations = world().team.find((member) => member.scope === 'operations');
    const owner = world().team.find((member) => member.scope === 'owner');
    setDelegated(operations?.id ?? '', true);
    expect(world().team.find((member) => member.id === operations?.id)?.delegated).toBe(true);
    const before = getState();
    setDelegated(owner?.id ?? '', false);
    setDelegated(operations?.id ?? '', true);
    setDelegated('nobody', true);
    expect(getState()).toBe(before);
  });
});
