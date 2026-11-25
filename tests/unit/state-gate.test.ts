/**
 * Regression tests for the release gate's findings on the state layer (packet "state"). Each block names
 * the finding it pins. They run the pure reducers on the seeded worlds, as the app does.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getService, loadAllServiceDetails, peekServiceDetail, services } from '@/data/catalog';
import type { ServiceDetail, ServiceId } from '@/data/types';
import { withdrawable } from '@/domain/chains';
import { journeyOf } from '@/domain/journey';
import { needsTenancy, plotsFor } from '@/domain/plots';
import { timingFor } from '@/domain/simulation';
import type { AppState, RequestState, World } from '@/domain/types';
import { currentVisit, progress } from '@/domain/workflow';
import { renewalTerms } from '@/state/effects';
import { calendarTiming, emptyWorld, initialSettings, seedWorld, STATE_VERSION } from '@/state/seed';
import { selectAppointments, selectCanWithdraw, selectHasPlots, selectPlotsFor, selectRenewalTerms, selectUnreadCount } from '@/state/selectors';
import { actIn, cancelIn, fastForwardIn, issuePassIn, payInvoiceIn, revokePassIn, startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';
import { requestView, standardClockOf } from '@/state/view';

const plain = (text: string | undefined): string => (text ?? '').replace(/⁠/g, '').replace(/ /g, ' ');

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 25, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const calendar: Env = { detail: peekServiceDetail, timing: calendarTiming };
const detail = (id: ServiceId): ServiceDetail => peekServiceDetail(id) as ServiceDetail;
const stateOf = (world: World): AppState => ({ version: STATE_VERSION, settings: initialSettings(), world, demo: { speed: 1 } });

beforeAll(async () => {
  await loadAllServiceDetails();
});

/** Moves a request on demo time until `stop` says so, acting for the investor with `answer` when it is asked. */
function drive(world: World, id: string, from: number, stop: (request: RequestState) => boolean, answer: (request: RequestState) => Parameters<typeof actIn>[2] | null = () => ({})): { world: World; now: number } {
  let next = world;
  let now = from;
  const read = () => next.requests.find((request) => request.id === id) as RequestState;
  for (let i = 0; i < 600 && !stop(read()); i++) {
    if (read().status === 'needs_you') {
      const payload = answer(read());
      if (payload === null) break;
      next = actIn(next, id, payload, now, live);
    } else next = fastForwardIn(next, id, now, live);
    now += 1000;
    next = tickWorld(next, now, live);
  }
  return { world: next, now };
}

const steps = (request: RequestState): number[] => request.visits.map((visit) => visit.step);

describe('n=1 · B2: a paid deposit is recorded without bank verification', () => {
  const run = (choice: string) => {
    const started = startIn(seedWorld('tenant', NOW), { serviceId: 'B2', plotId: 'BA-121' }, NOW + 1000, live);
    const { world } = drive(started.world, started.id, NOW + 2000, (request) => request.status === 'done' || request.status === 'stopped', (request) =>
      request.current === 3 ? { choice, ...(choice === 'guarantee' ? { files: [{ name: 'g.pdf' }] } : {}) } : { files: [{ name: 'g.pdf' }] },
    );
    return world.requests.find((request) => request.id === started.id) as RequestState;
  };

  it('the deposit skips the reading and checking of a guarantee (steps 4 to 8) and goes on to the register', () => {
    const request = run('deposit');
    expect(request.status).toBe('done');
    expect(steps(request)).toEqual([1, 2, 3, 9, 10, 11]);
  });

  it('the guarantee keeps the full verification route', () => {
    const request = run('guarantee');
    expect(request.status).toBe('done');
    expect(steps(request)).toEqual(expect.arrayContaining([4, 5, 7, 8, 9]));
  });

  it('right after the deposit, the request is not with the banks', () => {
    const started = startIn(seedWorld('tenant', NOW), { serviceId: 'B2', plotId: 'BA-121' }, NOW + 1000, live);
    const { world, now } = drive(started.world, started.id, NOW + 2000, (request) => request.status === 'needs_you');
    const after = actIn(world, started.id, { choice: 'deposit' }, now, live);
    const request = after.requests.find((candidate) => candidate.id === started.id) as RequestState;
    expect(request.current).toBe(9);
    expect(requestView(request, detail('B2'), now, 1).timeline.filter((entry) => entry.state === 'upcoming').map((entry) => entry.step)).toEqual([10, 11]);
  });
});

describe('n=15 · D1: a low rating reopens the request for the supervisor', () => {
  const rated = (stars: number) => {
    const started = startIn(seedWorld('tenant', NOW), { serviceId: 'D1', plotId: 'BA-121', form: { category: 'lighting', photo: { name: 'p.jpg' }, location: 'BA-121' } }, NOW + 1000, live);
    const ready = drive(started.world, started.id, NOW + 2000, (request) => request.status === 'needs_you' && request.current === 11);
    const world = actIn(ready.world, started.id, { rating: { stars, comment: 'still dark' } }, ready.now, live);
    return { world, id: started.id, now: ready.now };
  };

  it.each([1, 2])('%i stars: not finished, back with the supervisor, the rating kept and the investor told', (stars) => {
    const { world, id, now } = rated(stars);
    const request = world.requests.find((candidate) => candidate.id === id) as RequestState;
    expect(request.status).toBe('active');
    expect(request.current).toBe(10);
    expect(request.rating).toEqual({ stars, comment: 'still dark' });
    expect(request.reopenedAt).toBe(now);
    expect(request.reopenedRating).toEqual({ stars, comment: 'still dark' });
    const told = world.notifications.filter((notification) => notification.subject?.requestId === id && notification.at === now && notification.kind === 'update');
    expect(told.map((notification) => notification.title.en)).toContain('We reopened the report for the supervisor');
    expect(`${told[0]?.title.ar}${told[0]?.body.ar}${told[0]?.body.en}`).not.toMatch(/—|تذكرة|حالة/);
  });

  it('then follows the workflow as written until the investor is asked to rate again, and a good rating closes it', () => {
    const { world, id, now } = rated(1);
    const again = drive(world, id, now + 1000, (request) => request.status === 'needs_you' && request.current === 11);
    const reopened = again.world.requests.find((candidate) => candidate.id === id) as RequestState;
    const visits = steps(reopened);
    expect(visits.slice(visits.indexOf(10))).toEqual([10, 6, 7, 8, 9, 11]);
    const closed = actIn(again.world, id, { rating: 4 }, again.now, live).requests.find((candidate) => candidate.id === id) as RequestState;
    expect(closed.status).toBe('done');
    expect(closed.rating).toEqual({ stars: 4 });
    expect(closed.reopenedRating?.stars).toBe(1);
  });

  it('three stars or more finishes as before', () => {
    const { world, id } = rated(3);
    const request = world.requests.find((candidate) => candidate.id === id) as RequestState;
    expect(request.status).toBe('done');
    expect(request.reopenedAt).toBeUndefined();
  });
});

describe('n=15, the same rule in the other two rating steps · E1 and E6: a low rating reopens the request for the supervisor', () => {
  // E1 step 9 and E6 step 10 say it as D1 step 11 does: "a low rating reopens the case for the BSC supervisor".
  const cases = [
    { serviceId: 'E1' as ServiceId, rateAt: 9, backTo: 5, title: 'We reopened your request for the Business Services Center supervisor' },
    { serviceId: 'E6' as ServiceId, rateAt: 10, backTo: 6, title: 'We reopened your complaint for the Business Services Center supervisor' },
  ];
  const rated = (serviceId: ServiceId, rateAt: number, stars: number) => {
    const started = startIn(seedWorld('tenant', NOW), { serviceId, form: { subject: 'demo', details: 'demo' } }, NOW + 1000, live);
    const ready = drive(started.world, started.id, NOW + 2000, (request) => request.status === 'needs_you' && request.current === rateAt);
    const world = actIn(ready.world, started.id, { rating: { stars } }, ready.now, live);
    return { world, id: started.id, now: ready.now };
  };

  it.each(cases)('$serviceId: one star sends it back to the staff step, keeps the rating and tells the investor', ({ serviceId, rateAt, backTo, title }) => {
    const { world, id, now } = rated(serviceId, rateAt, 1);
    const request = world.requests.find((candidate) => candidate.id === id) as RequestState;
    expect(request.status).toBe('active');
    expect(request.current).toBe(backTo);
    expect(detail(serviceId).workflow.steps.find((step) => step.id === backTo)?.lane).toBe('staff');
    expect(request.reopenedRating).toEqual({ stars: 1 });
    const told = world.notifications.filter((notification) => notification.subject?.requestId === id && notification.at === now && notification.kind === 'update');
    expect(told.map((notification) => notification.title.en)).toContain(title);
    expect(`${told[0]?.title.ar}${told[0]?.body.ar}${told[0]?.title.en}${told[0]?.body.en}`).not.toMatch(/—|تذكرة|حالة|\bcase\b|ticket/);
  });

  it.each(cases)('$serviceId: it then runs as written until the rating is asked again, and a good rating closes it', ({ serviceId, rateAt, backTo }) => {
    const { world, id, now } = rated(serviceId, rateAt, 2);
    const again = drive(world, id, now + 1000, (request) => request.status === 'needs_you' && request.current === rateAt);
    const reopened = again.world.requests.find((candidate) => candidate.id === id) as RequestState;
    const visits = steps(reopened);
    const after = visits.slice(visits.lastIndexOf(backTo));
    expect(after[0]).toBe(backTo);
    expect(after[after.length - 1]).toBe(rateAt);
    const closed = actIn(again.world, id, { rating: 5 }, again.now, live);
    const done = drive(closed, id, again.now + 1000, (request) => request.status === 'done' || request.status === 'stopped').world.requests.find((candidate) => candidate.id === id) as RequestState;
    expect(done.status).toBe('done');
    expect(done.rating).toEqual({ stars: 5 });
    expect(done.reopenedRating?.stars).toBe(2);
  });

  it.each(cases)('$serviceId: three stars finishes as before', ({ serviceId, rateAt }) => {
    const { world, id, now } = rated(serviceId, rateAt, 3);
    const done = drive(world, id, now + 1000, (request) => request.status === 'done' || request.status === 'stopped').world.requests.find((candidate) => candidate.id === id) as RequestState;
    expect(done.status).toBe('done');
    expect(done.reopenedAt).toBeUndefined();
  });
});

describe('n=7 · a withdrawn request never reads its open step as done', () => {
  const tenant = () => seedWorld('tenant', NOW);
  const cancelOf = (serviceId: ServiceId) => {
    const world = tenant();
    const open = world.requests.find((request) => request.serviceId === serviceId && request.status === 'active') as RequestState;
    const after = cancelIn(world, open.id, NOW + 60_000, live);
    return { before: open, after: after.requests.find((request) => request.id === open.id) as RequestState };
  };

  it.each(['D1', 'C2'] as ServiceId[])('%s: the open step is stopped, not done', (serviceId) => {
    const { before, after } = cancelOf(serviceId);
    const last = after.visits.at(-1);
    expect(after.status).toBe('stopped');
    expect(last?.step).toBe(before.current);
    expect(last?.doneAt).toBeUndefined();
    expect(last?.stoppedAt).toBe(NOW + 60_000);
    expect(currentVisit(after)).toBeUndefined();
    const view = requestView(after, detail(serviceId), NOW + 120_000, 1);
    expect(view.timeline.at(-1)).toMatchObject({ step: before.current, state: 'stopped', time: NOW + 60_000 });
    expect(view.timeline.filter((entry) => entry.state === 'stopped')).toHaveLength(1);
    expect(view.heldSince).toBeUndefined();
    expect(view.finishedAt).toBe(NOW + 60_000);
    expect(view.progress).toBeLessThan(1);
  });

  it('the standard clock stops when the request is withdrawn', () => {
    const { after } = cancelOf('C2');
    const service = detail('C2');
    expect(standardClockOf(after, service, NOW + 10 * DAY, 1)).toEqual(standardClockOf(after, service, NOW + 60_001, 1));
  });

  it('a withdrawn request that waited for the investor keeps the wait off the clock', () => {
    const world = tenant();
    const renewal = world.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const after = cancelIn(world, renewal.id, NOW + 60_000, live).requests.find((request) => request.id === renewal.id) as RequestState;
    expect(after.visits.at(-1)).toMatchObject({ step: renewal.current, stoppedAt: NOW + 60_000 });
    expect(after.visits.at(-1)?.doneAt).toBeUndefined();
    expect(progress(detail('B3').workflow, after)).toBeLessThan(1);
  });
});

describe('n=8 · the journey after a withdrawal', () => {
  it('the building permit is not "in progress" once withdrawn: nothing is open for it', () => {
    const world = seedWorld('tenant', NOW);
    const permit = world.requests.find((request) => request.serviceId === 'C2') as RequestState;
    const before = journeyOf(world, 'AW-116').stations.find((station) => station.key === 'build')?.items.find((item) => item.serviceId === 'C2');
    expect(before).toMatchObject({ state: 'current', open: true, requestId: permit.id });
    expect(before?.stoppedRequestId).toBeUndefined();

    const after = cancelIn(world, permit.id, NOW + 60_000, live);
    const item = journeyOf(after, 'AW-116').stations.find((station) => station.key === 'build')?.items.find((candidate) => candidate.serviceId === 'C2');
    expect(item?.open).toBe(false);
    expect(item?.stoppedRequestId).toBe(permit.id);
    expect(item?.requestId).toBeUndefined();
    // The utilities request really is running.
    const utilities = journeyOf(after, 'AW-116').stations.find((station) => station.key === 'build')?.items.find((candidate) => candidate.serviceId === 'C4');
    expect(utilities).toMatchObject({ state: 'current', open: true });
  });
});

describe('n=8, at its root · the investor withdraws only an application of their own', () => {
  it('a service the investor starts can be withdrawn, and so can the stages of a land application', () => {
    for (const id of ['A4', 'A5', 'A6', 'A7', 'A8', 'C1', 'D1', 'D2', 'E1', 'B8'] as ServiceId[]) expect([id, withdrawable(id)]).toEqual([id, true]);
  });

  it('a request Manateq starts cannot, nor one that follows from several services', () => {
    // Invoices, renewal, collections, the ministry permit, inspections, notices; then the deposit and the utilities connection.
    for (const id of ['B1', 'B3', 'B10', 'C2', 'C3', 'C7', 'C8', 'D4', 'D6', 'B2', 'C4'] as ServiceId[]) expect([id, withdrawable(id)]).toEqual([id, false]);
  });

  it('every service that can be withdrawn can be asked for again', () => {
    for (const service of services) {
      if (!withdrawable(service.id)) continue;
      let at = service;
      while (at.triggeredBy.kind !== 'investor') at = getService((at.triggeredBy.after as ServiceId[])[0] as ServiceId) as typeof service;
      expect(at.triggeredBy.kind).toBe('investor');
    }
  });

  it('the seeded tenant: the fault report yes; the renewal, the building permit and the utilities request no; nothing once it is closed', () => {
    const world = seedWorld('tenant', NOW);
    const of = (serviceId: ServiceId) => world.requests.find((request) => request.serviceId === serviceId && request.status !== 'done') as RequestState;
    expect(selectCanWithdraw(of('D1').id)(stateOf(world))).toBe(true);
    for (const id of ['B3', 'C2', 'C4'] as ServiceId[]) expect([id, selectCanWithdraw(of(id).id)(stateOf(world))]).toEqual([id, false]);
    const closed = cancelIn(world, of('D1').id, NOW + 1000, live);
    expect(selectCanWithdraw(of('D1').id)(stateOf(closed))).toBe(false);
    expect(selectCanWithdraw(undefined)(stateOf(world))).toBe(false);
  });
});

describe('last look · a request and the pass it issued never disagree', () => {
  // As the gate pass flow does: the pass is issued on the spot, then the request that records it is started.
  const issued = () => {
    const pass = issuePassIn(seedWorld('tenant', NOW), { kind: 'worker', holder: 'Ali', idOrPlate: '28763412345', plotId: 'BA-121', from: NOW, to: NOW + 5 * DAY }, NOW);
    const form = { passType: 'worker', holder: 'Ali', qid: '28763412345', validFrom: NOW, validTo: NOW + 5 * DAY, plot: 'BA-121' };
    const started = startIn(pass.world, { serviceId: 'D2', plotId: 'BA-121', passId: pass.id, form }, NOW + 1000, live);
    return { world: started.world, requestId: started.id, passId: pass.id };
  };
  const passOf = (world: World, id: string) => world.passes.find((pass) => pass.id === id);
  const requestOf = (world: World, id: string) => world.requests.find((request) => request.id === id) as RequestState;

  it('ties the pass to its request from the start', () => {
    const { world, requestId, passId } = issued();
    expect(passOf(world, passId)).toMatchObject({ status: 'active', requestId });
    expect(requestOf(world, requestId).status).toBe('active');
    expect(selectCanWithdraw(requestId)(stateOf(world))).toBe(true);
  });

  it('withdrawing the request revokes its pass, and no other', () => {
    const { world, requestId, passId } = issued();
    const after = cancelIn(world, requestId, NOW + 5000, live);
    expect(requestOf(after, requestId).status).toBe('stopped');
    expect(passOf(after, passId)?.status).toBe('revoked');
    for (const other of after.passes.filter((pass) => pass.id !== passId)) expect(other.status).toBe(passOf(world, other.id)?.status);
  });

  it('run to its end, the request keeps its one pass and issues no second one', () => {
    const { world, requestId, passId } = issued();
    const done = drive(world, requestId, NOW + 2000, (request) => request.status === 'done' || request.status === 'stopped').world;
    expect(requestOf(done, requestId).status).toBe('done');
    expect(done.passes.filter((pass) => pass.requestId === requestId).map((pass) => [pass.id, pass.status])).toEqual([[passId, 'active']]);
  });

  it('a pass cancelled while its request runs is not issued again when the request ends', () => {
    const { world, requestId, passId } = issued();
    const revoked = revokePassIn(world, passId);
    const done = drive(revoked, requestId, NOW + 2000, (request) => request.status === 'done' || request.status === 'stopped').world;
    expect(done.passes.filter((pass) => pass.requestId === requestId).map((pass) => [pass.id, pass.status])).toEqual([[passId, 'revoked']]);
    expect(done.passes.filter((pass) => pass.holder === 'Ali' && pass.status === 'active')).toEqual([]);
  });
});

describe('n=3 and n=6 · a "needs you" notification is settled once its ask is done', () => {
  it('paying the invoice settles its reminder, adds a read "payment received" note and the bell drops', () => {
    const world = seedWorld('tenant', NOW);
    const reminder = world.notifications.find((notification) => notification.kind === 'action' && notification.subject?.invoiceId !== undefined);
    expect(reminder).toBeDefined();
    const invoiceId = reminder?.subject?.invoiceId as string;
    const unread = selectUnreadCount(stateOf(world));
    const paid = payInvoiceIn(world, invoiceId, NOW + 1000);
    const settled = paid.world.notifications.find((notification) => notification.id === reminder?.id);
    expect(settled).toMatchObject({ read: true, resolvedAt: NOW + 1000 });
    expect(selectUnreadCount(stateOf(paid.world))).toBe(unread - 1);
    const note = paid.world.notifications.at(-1);
    expect(note).toMatchObject({ kind: 'done', route: `/account/wallet/${paid.docId}`, read: true, subject: { invoiceId } });
    expect(plain(note?.title.en)).toBe('Payment received. The receipt is in Documents and passes');
    expect(note?.title.ar).not.toMatch(/—/);
  });

  it('completing the renewal settles "accept the renewal offer and pay"', () => {
    const world = seedWorld('tenant', NOW);
    const renewal = world.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const ask = world.notifications.find((notification) => notification.kind === 'action' && notification.subject?.requestId === renewal.id);
    expect(ask).toMatchObject({ read: false, subject: { step: renewal.current } });
    const unread = selectUnreadCount(stateOf(world));
    const after = actIn(world, renewal.id, { form: {} }, NOW + 1000, live);
    expect(after.notifications.find((notification) => notification.id === ask?.id)).toMatchObject({ read: true, resolvedAt: NOW + 1000 });
    expect(selectUnreadCount(stateOf(after))).toBeLessThan(unread);
  });

  it('withdrawing a request settles what it asked for', () => {
    const world = seedWorld('tenant', NOW);
    const renewal = world.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const after = cancelIn(world, renewal.id, NOW + 1000, live);
    expect(after.notifications.filter((notification) => notification.subject?.requestId === renewal.id && notification.kind === 'action').every((notification) => notification.resolvedAt === NOW + 1000)).toBe(true);
  });

  it('every seeded "needs you" is linked to what it asks about', () => {
    const world = seedWorld('tenant', NOW);
    for (const notification of world.notifications.filter((candidate) => candidate.kind === 'action')) expect(notification.subject, plain(notification.title.en)).toBeDefined();
    // Answered asks of the history are settled, not unread.
    for (const notification of world.notifications.filter((candidate) => candidate.resolvedAt !== undefined)) expect(notification.read).toBe(true);
  });
});

describe('n=6, second look · every payment leaves the same note, whichever screen it was made on', () => {
  it('paying inside a request step adds a read "payment received" note that opens its receipt', () => {
    // The lease renewal: accept, sign and pay the first instalment at step 8.
    const world = seedWorld('tenant', NOW);
    const renewal = world.requests.find((request) => request.serviceId === 'B3') as RequestState;
    expect(renewal.status).toBe('needs_you');
    const before = world.notifications.length;
    const after = actIn(world, renewal.id, {}, NOW + 1000, live);
    const notes = after.notifications.slice(before).filter((notification) => notification.title.en.startsWith('Payment received'));
    expect(notes).toHaveLength(1);
    const note = notes[0] as World['notifications'][number];
    expect(note.read).toBe(true);
    expect(note.kind).toBe('done');
    const receipt = after.docs.find((doc) => `/account/wallet/${doc.id}` === note.route);
    expect(receipt).toBeDefined();
    const invoice = after.invoices.find((candidate) => candidate.id === note.subject?.invoiceId);
    expect(invoice).toMatchObject({ status: 'paid', requestId: renewal.id, receiptDocId: receipt?.id });
    // It never counts as unread.
    expect(selectUnreadCount(stateOf(after))).toBeLessThanOrEqual(selectUnreadCount(stateOf(world)));
  });

  it('the seeded history stays as it was: payments made long ago raise nothing new', () => {
    const titles = seedWorld('tenant', NOW).notifications.map((notification) => notification.title.en);
    expect(titles.filter((title) => title.startsWith('Payment received'))).toEqual([]);
  });
});

describe('n=14 · E1: asking for an appointment books one', () => {
  const start = (form: Record<string, string | boolean>) => startIn(seedWorld('tenant', NOW), { serviceId: 'E1', form: { request: 'I need help with my permit', ...form } }, NOW + 1000, live);

  it('books 10:00 on the preferred day, in person, linked to the request, and tells the investor', () => {
    const { world, id } = start({ bookAppointment: true, preferredDate: '2026-11-29' });
    const appointment = world.appointments.find((candidate) => candidate.requestId === id);
    expect(appointment).toMatchObject({ at: new Date(2026, 10, 29, 10, 0).getTime(), channel: 'in_person', status: 'booked', topic: getService('E1')?.requestLabel });
    expect(selectAppointments(stateOf(world))).toContain(appointment);
    const note = world.notifications.at(-1);
    expect(note).toMatchObject({ route: '/account/support', subject: { requestId: id } });
    expect(plain(note?.title.en)).toBe('Your Business Services Center appointment is booked');
    expect(plain(note?.body.en)).toContain('29 Nov 2026');
  });

  it('takes the channel the form names', () => {
    const { world, id } = start({ bookAppointment: true, preferredDate: '2026-11-30', channel: 'video' });
    expect(world.appointments.find((candidate) => candidate.requestId === id)?.channel).toBe('video');
  });

  it('books nothing without the toggle or without a day', () => {
    expect(start({ bookAppointment: false, preferredDate: '2026-11-29' }).world.appointments.some((candidate) => candidate.requestId !== undefined)).toBe(false);
    expect(start({ bookAppointment: true }).world.appointments.some((candidate) => candidate.requestId !== undefined)).toBe(false);
  });

  it('withdrawing the request cancels its appointment', () => {
    const { world, id } = start({ bookAppointment: true, preferredDate: '2026-11-29' });
    const after = cancelIn(world, id, NOW + 2000, live);
    expect(after.appointments.find((candidate) => candidate.requestId === id)?.status).toBe('cancelled');
  });
});

describe('n=0 · the handover started without a plot', () => {
  /** A prospect whose contract is signed: one plot, leased and not handed over yet. */
  const leasedProspect = (): World => {
    const world = seedWorld('tenant', NOW);
    return { ...world, plots: world.plots.map((plot) => (plot.id === 'AW-116' ? { ...plot, status: 'leased' as const } : plot)) };
  };

  it('plotsFor offers only leased plots not handed over for A8, every held plot otherwise', () => {
    const world = leasedProspect();
    expect(plotsFor(world, 'A8').map((plot) => plot.id)).toEqual(['AW-116']);
    expect(plotsFor(world, 'B8').map((plot) => plot.id).sort()).toEqual(['AK-113', 'AW-116', 'BA-121']);
    expect(plotsFor({ plots: [{ id: 'AW-1', number: 'AW-101', zoneCode: 'AW', areaSqm: 1, solution: 'logistics', status: 'reserved' }] }, 'B8')).toEqual([]);
    expect(selectPlotsFor('A8')(stateOf(world))).toBe(selectPlotsFor('A8')(stateOf(world)));
    // The layout of a zone is still there under the same name.
    expect(plotsFor('BA')).toHaveLength(40);
  });

  it('takes the one plot that qualifies, so the handover marks it handed over', () => {
    const started = startIn(leasedProspect(), { serviceId: 'A8', form: { slot: NOW + DAY } }, NOW + 1000, live);
    expect(started.world.requests.find((request) => request.id === started.id)?.plotId).toBe('AW-116');
    const { world } = drive(started.world, started.id, NOW + 2000, (request) => request.status === 'done');
    expect(world.plots.find((plot) => plot.id === 'AW-116')?.status).toBe('handed_over');
  });

  it('leaves the plot unset when several qualify (the start flow asks) or none does', () => {
    const tenant = seedWorld('tenant', NOW);
    const several = startIn(tenant, { serviceId: 'B8', form: {} }, NOW + 1000, live);
    expect(several.world.requests.find((request) => request.id === several.id)?.plotId).toBeUndefined();
    const none = startIn(seedWorld('prospect', NOW), { serviceId: 'A8', form: {} }, NOW + 1000, live);
    expect(none.world.requests.find((request) => request.id === none.id)?.plotId).toBeUndefined();
  });
});

describe('n=21 · services that need a plot', () => {
  it('needsTenancy says which services are only for a company that holds a plot', () => {
    for (const id of ['A8', 'B7', 'B8', 'C1', 'C6', 'D1', 'D7', 'B3'] as ServiceId[]) expect(needsTenancy(getService(id) as NonNullable<ReturnType<typeof getService>>), id).toBe(true);
    for (const id of ['A1', 'A2', 'A4', 'E1', 'E4', 'G1', 'D3'] as ServiceId[]) expect(needsTenancy(getService(id) as NonNullable<ReturnType<typeof getService>>), id).toBe(false);
    // B6 is offered to prospects too, but its form requires a plot.
    expect(needsTenancy(getService('B6') as NonNullable<ReturnType<typeof getService>>)).toBe(false);
    expect(needsTenancy(detail('B6'))).toBe(true);
  });

  it('selectHasPlots tells a prospect from a tenant', () => {
    expect(selectHasPlots(stateOf(seedWorld('prospect', NOW)))).toBe(false);
    expect(selectHasPlots(stateOf(seedWorld('tenant', NOW)))).toBe(true);
    expect(selectHasPlots(stateOf(emptyWorld('guest')))).toBe(false);
  });
});

describe('n=10 · the renewal offer states its terms', () => {
  it('gives the new end, the term, the rate and the first instalment, by the rule the renewal applies', () => {
    const world = seedWorld('tenant', NOW);
    const renewal = world.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const lease = world.leases.find((candidate) => candidate.plotId === 'AK-113');
    const terms = selectRenewalTerms(renewal.id)(stateOf(world));
    expect(terms).toMatchObject({ plotId: 'AK-113', years: 1, ratePerSqm: 10, annualRent: 50_000, firstInstalment: 50_000 });
    expect(new Date(terms?.until ?? 0).getFullYear()).toBe(new Date(lease?.endsAt ?? 0).getFullYear() + 1);
    expect(selectRenewalTerms(renewal.id)(stateOf(world))).toBe(terms);
    expect(selectRenewalTerms(world.requests.find((request) => request.serviceId === 'C2')?.id)(stateOf(world))).toBeUndefined();

    // Accepting, signing and paying: the lease then ends exactly where the offer said.
    const { world: after } = drive(actIn(world, renewal.id, { form: {} }, NOW + 1000, calendar), renewal.id, NOW + 2000, (request) => request.status === 'done');
    expect(after.leases.find((candidate) => candidate.plotId === 'AK-113')?.endsAt).toBe(terms?.until);
    expect(renewalTerms(world, renewal)).toEqual(terms);
  });
});

describe('n=12 · document wording', () => {
  it('names the request with its noun and gives the issue date once', () => {
    const world = seedWorld('tenant', NOW);
    const noc = world.docs.find((doc) => doc.kind === 'noc');
    const service = noc?.lines.find((line) => line.label.en === 'Service');
    expect(service?.value).toEqual({ ar: 'مراجعة التصميم', en: 'Design review' });
    expect(noc?.lines.some((line) => line.label.en === 'Issued on' || line.label.ar === 'تاريخ الإصدار')).toBe(false);
  });
});

describe('n=13 · the seeded utilities request keeps to its standard', () => {
  it('is expected within the days its standard has left, and its step date agrees', () => {
    const world = seedWorld('tenant', NOW);
    const utilities = world.requests.find((request) => request.serviceId === 'C4') as RequestState;
    const view = requestView(utilities, detail('C4'), NOW, 1);
    expect(view.clock).toMatchObject({ targetDays: 10, dayNumber: 8 });
    const left = (view.clock.targetDays as number) - view.clock.usedDays;
    const daysToGo = ((view.expectedAt as number) - NOW) / DAY;
    expect(daysToGo).toBeGreaterThan(0);
    expect(daysToGo).toBeLessThanOrEqual(left + 1e-9);
    expect(view.timeline.find((entry) => entry.state === 'current')?.time).toBe(view.expectedAt);
  });
});
