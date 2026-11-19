import { beforeAll, describe, expect, it } from 'vitest';
import { getService, getSolution, getZone, loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { L10n, ServiceDetail } from '@/data/types';
import { VERIFY_CODE_PATTERN } from '@/domain/documents';
import { collectNextSteps } from '@/domain/nextstep';
import type { Persona, RequestState, World } from '@/domain/types';
import { act, advance, findStep, firstStep, isTerminal, successor, waitsForInvestor, type Timing } from '@/domain/workflow';
import { STATE_VERSION, calendarTiming, emptyWorld, initialSettings, initialState, seedIsPartial, seedWorld } from '@/state/seed';
import { fastForwardIn, tickWorld } from '@/state/sim';
import { holdOf, type Env } from '@/state/types';

const DAY = 86_400_000;
const HOUR = 3_600_000;
/** A Thursday morning, a Sunday night and the turn of a year: seeds must hold at any moment. */
const MOMENTS = [new Date(2026, 10, 19, 9, 30).getTime(), new Date(2027, 1, 14, 23, 50).getTime(), new Date(2027, 0, 1, 0, 5).getTime()];
const NOW = MOMENTS[0] as number;
const PERSONAS: Persona[] = ['guest', 'prospect', 'tenant'];

const calendar: Env = { detail: peekServiceDetail, timing: calendarTiming };
const instant: Timing = { duration: () => 0 };
const detailOf = (request: RequestState): ServiceDetail => peekServiceDetail(request.serviceId) as ServiceDetail;

beforeAll(async () => {
  await loadAllServiceDetails();
});

const bilingual = (text: L10n, what: string) => {
  expect(text.ar.trim(), `${what} (ar)`).not.toBe('');
  expect(text.en.trim(), `${what} (en)`).not.toBe('');
};

/** A request is a real engine state when its visits are a walk through the workflow the engine itself could have made. */
function expectEngineState(request: RequestState, now: number): void {
  const service = detailOf(request);
  expect(service, `${request.serviceId} has no workflow`).toBeDefined();
  const wf = service.workflow;
  const label = `${request.serviceId} ${request.id}`;
  expect(request.visits.length, label).toBeGreaterThan(0);
  expect(request.visits[0]?.step, label).toBe(firstStep(wf).id);
  expect(request.visits[0]?.enteredAt, label).toBe(request.createdAt);

  let investorMs = 0;
  request.visits.forEach((visit, index) => {
    const step = findStep(wf, visit.step);
    expect(step, `${label}: step ${visit.step} does not exist`).toBeDefined();
    if (!step) return;
    expect(visit.enteredAt, label).toBeLessThanOrEqual(now);
    const next = request.visits[index + 1];
    if (next) {
      expect(visit.doneAt, `${label}: a visit in the middle is still open`).toBeDefined();
      expect(next.step, `${label}: ${visit.step} → ${next.step} is not a move the workflow allows`).toBe(successor(wf, step, visit.outcome ?? 'yes'));
      expect(next.enteredAt, label).toBe(visit.doneAt);
    }
    if (visit.doneAt !== undefined) {
      expect(visit.doneAt, label).toBeGreaterThanOrEqual(visit.enteredAt);
      expect(visit.doneAt, label).toBeLessThanOrEqual(now);
      if (waitsForInvestor(step)) investorMs += visit.doneAt - visit.enteredAt;
      if (step.kind === 'gate') expect(visit.outcome, `${label}: a decision without an outcome`).toBeDefined();
    }
  });
  expect(request.investorMs, `${label}: investor time`).toBe(investorMs);

  const last = request.visits[request.visits.length - 1];
  const lastStep = last ? findStep(wf, last.step) : undefined;
  if (request.status === 'done' || request.status === 'stopped') {
    expect(request.current, label).toBeNull();
    expect(last?.doneAt, label).toBeDefined();
    expect(lastStep && isTerminal(lastStep), `${label} ended on a step that is not an end`).toBe(true);
    expect(lastStep?.kind === 'end' ? 'done' : 'stopped', label).toBe(request.status);
    expect(holdOf(request), `${label}: a finished request is still held`).toBeUndefined();
  } else {
    expect(request.current, label).toBe(last?.step);
    expect(last?.doneAt, label).toBeUndefined();
    expect(request.status === 'needs_you', `${label}: status ${request.status} at step ${request.current}`).toBe(lastStep ? waitsForInvestor(lastStep) : false);
    if (request.status === 'needs_you') expect(service.actions.some((action) => action.step === request.current), `${label}: no action for step ${request.current}`).toBe(true);
  }

  // …and the engine can take it from here to an end.
  let moving = request;
  for (let i = 0; i < 300 && moving.current !== null; i++) {
    moving = advance(moving, wf, now + i, instant).req;
    if (moving.status === 'needs_you') moving = act(moving, wf, now + i, instant).req;
  }
  expect(moving.current, `${label} cannot be finished from its seeded state`).toBeNull();
}

function expectValidWorld(world: World, now: number): void {
  const plotIds = new Set(world.plots.map((plot) => plot.id));
  const leaseIds = new Set(world.leases.map((lease) => lease.id));
  const requestIds = new Set(world.requests.map((request) => request.id));
  const docIds = new Set(world.docs.map((doc) => doc.id));
  const invoiceIds = new Set(world.invoices.map((invoice) => invoice.id));

  // One id, one record — across every list.
  const everyId = [...world.plots, ...world.leases, ...world.requests, ...world.invoices, ...world.docs, ...world.passes, ...world.notifications, ...world.appointments, ...world.team].map((record) => record.id);
  expect(new Set(everyId).size).toBe(everyId.length);
  const highest = Math.max(0, ...everyId.map((id) => Number(/\d+$/.exec(id)?.[0] ?? 0)).filter((n) => n < 10_000));
  expect(world.seq).toBeGreaterThanOrEqual(Math.min(highest, world.seq));

  for (const plot of world.plots) {
    expect(getZone(plot.zoneCode), `zone ${plot.zoneCode}`).toBeDefined();
    expect(getZone(plot.zoneCode)?.solutions, `${plot.number}: ${plot.solution} in ${plot.zoneCode}`).toContain(plot.solution);
    expect(plot.areaSqm).toBeGreaterThan(0);
    if (plot.leaseId !== undefined) {
      expect(leaseIds.has(plot.leaseId), `${plot.number}: lease ${plot.leaseId}`).toBe(true);
      expect(world.leases.find((lease) => lease.id === plot.leaseId)?.plotId).toBe(plot.id);
    } else {
      expect(plot.status, `${plot.number} has no lease`).toBe('reserved');
    }
  }

  for (const lease of world.leases) {
    const plot = world.plots.find((candidate) => candidate.id === lease.plotId);
    expect(plot, `lease ${lease.ref}: plot ${lease.plotId}`).toBeDefined();
    if (!plot) continue;
    expect(plot.leaseId).toBe(lease.id);
    expect(lease.ref).toMatch(/^LC-\d{4}-\d{4}$/);
    // Published prices: logistics 15, industrial 5, commercial 50, open yards 10 QAR per m² per year.
    expect(lease.ratePerSqmYear).toBe(getSolution(plot.solution)?.price.qarPerSqmYear);
    expect(lease.annualRent).toBe(lease.ratePerSqmYear * plot.areaSqm);
    expect(lease.endsAt).toBeGreaterThan(lease.startsAt);
    expect(lease.startsAt).toBeLessThanOrEqual(now);
  }

  const refs = world.requests.map((request) => request.ref);
  expect(new Set(refs).size).toBe(refs.length);
  for (const request of world.requests) {
    expect(getService(request.serviceId), `service ${request.serviceId}`).toBeDefined();
    expect(request.ref).toMatch(/^MQ-\d{4}-\d{4}$/);
    expectEngineState(request, now);
    expect(world.requests.some((other) => other.id === request.threadId), `${request.id}: thread ${request.threadId}`).toBe(true);
    if (request.parentId !== undefined) {
      const parent = world.requests.find((other) => other.id === request.parentId);
      expect(parent, `${request.id}: parent ${request.parentId}`).toBeDefined();
      expect(parent?.threadId).toBe(request.threadId);
      expect(parent?.status).toBe('done');
    }
    if (request.plotId !== undefined) expect(plotIds.has(request.plotId), `${request.id}: plot ${request.plotId}`).toBe(true);
    for (const docId of request.docIds) expect(docIds.has(docId), `${request.id}: document ${docId}`).toBe(true);
    expect(request.createdAt).toBeLessThanOrEqual(request.updatedAt);
    expect(request.updatedAt).toBeLessThanOrEqual(now);
    const hold = holdOf(request);
    if (hold !== undefined) {
      expect(request.status, `${request.id} is held but not moving`).toBe('active');
      expect(hold).toBeGreaterThan(now);
    }
  }

  for (const invoice of world.invoices) {
    expect(invoice.ref).toMatch(/^INV-\d{4}-\d{4}$/);
    bilingual(invoice.title, `invoice ${invoice.ref}`);
    expect(invoice.amount).toBeGreaterThan(0);
    expect(invoice.issuedAt).toBeLessThanOrEqual(invoice.dueAt);
    expect(invoice.issuedAt).toBeLessThanOrEqual(now);
    if (invoice.leaseId !== undefined) expect(leaseIds.has(invoice.leaseId), `${invoice.ref}: lease`).toBe(true);
    if (invoice.requestId !== undefined) expect(requestIds.has(invoice.requestId), `${invoice.ref}: request`).toBe(true);
    if (invoice.status === 'paid') {
      expect(invoice.paidAt, invoice.ref).toBeDefined();
      expect(invoice.paidAt as number).toBeLessThanOrEqual(now);
      const receipt = world.docs.find((doc) => doc.id === invoice.receiptDocId);
      expect(receipt?.kind, `${invoice.ref}: receipt`).toBe('receipt');
      expect(receipt?.ref).toBe(invoice.ref.replace('INV-', 'RCP-'));
      expect(receipt?.issuedAt).toBe(invoice.paidAt);
    } else {
      expect(invoice.receiptDocId, invoice.ref).toBeUndefined();
      expect(invoice.status, invoice.ref).toBe(invoice.dueAt < now ? 'overdue' : 'due');
    }
  }

  const codes = world.docs.map((doc) => doc.verifyCode);
  expect(new Set(codes).size).toBe(codes.length);
  for (const doc of world.docs) {
    bilingual(doc.title, `document ${doc.ref}`);
    bilingual(doc.issuer, `issuer of ${doc.ref}`);
    expect(doc.verifyCode).toMatch(VERIFY_CODE_PATTERN);
    expect(doc.issuedAt).toBeLessThanOrEqual(now);
    expect(doc.lines.length).toBeGreaterThan(2);
    for (const line of doc.lines) {
      bilingual(line.label, `a line of ${doc.ref}`);
      bilingual(line.value, `a line of ${doc.ref}`);
    }
    expect(`${doc.title.ar}${doc.title.en}${doc.lines.map((line) => line.label.ar + line.value.ar + line.label.en + line.value.en).join('')}`).not.toContain('—');
    if (doc.serviceId !== undefined) expect(getService(doc.serviceId), `${doc.ref}: service`).toBeDefined();
    if (doc.requestId !== undefined) {
      const request = world.requests.find((candidate) => candidate.id === doc.requestId);
      expect(request, `${doc.ref}: request ${doc.requestId}`).toBeDefined();
      expect(request?.docIds, `${doc.ref} is not filed against its request`).toContain(doc.id);
    }
    if (doc.kind === 'receipt') expect(world.invoices.some((invoice) => invoice.receiptDocId === doc.id), `${doc.ref}: invoice`).toBe(true);
  }

  for (const pass of world.passes) {
    expect(plotIds.has(pass.plotId), `pass ${pass.id}: plot`).toBe(true);
    expect(pass.from).toBeLessThanOrEqual(pass.to);
    expect(pass.code).toMatch(/^GP-[0-9A-Z]{6}$/);
    expect(pass.holder.trim()).not.toBe('');
    if (pass.status !== 'revoked') expect(pass.status, `pass ${pass.id}`).toBe(pass.to < now ? 'expired' : 'active');
  }

  for (const notification of world.notifications) {
    bilingual(notification.title, `notification ${notification.id}`);
    bilingual(notification.body, `notification ${notification.id}`);
    expect(notification.at).toBeLessThanOrEqual(now);
    const route = notification.route;
    if (!route) continue;
    const request = /^\/requests\/(.+)$/.exec(route)?.[1];
    if (request) expect(requestIds.has(request), `notification → ${route}`).toBe(true);
    const invoice = /^\/account\/payments\/(.+)$/.exec(route)?.[1];
    if (invoice) expect(invoiceIds.has(invoice), `notification → ${route}`).toBe(true);
    const zone = /^\/zones\/(.+)$/.exec(route)?.[1];
    if (zone) expect(getZone(zone), `notification → ${route}`).toBeDefined();
  }

  for (const appointment of world.appointments) bilingual(appointment.topic, `appointment ${appointment.id}`);
  for (const member of world.team) {
    bilingual(member.name, `team member ${member.id}`);
    bilingual(member.role, `team member ${member.id}`);
  }
  for (const code of world.watchedZones) expect(getZone(code)).toBeDefined();

  // A world is plain JSON: it survives being saved and restored exactly.
  expect(JSON.parse(JSON.stringify(world))).toStrictEqual(world);
}

describe('first-run state', () => {
  it('starts as a guest who has not seen the welcome screen', () => {
    const state = initialState();
    expect(state.version).toBe(STATE_VERSION);
    expect(state.settings).toEqual(initialSettings());
    expect(state.settings.onboarded).toBe(false);
    expect(state.world).toEqual(emptyWorld('guest'));
    expect(state.demo.speed).toBe(1);
  });
});

describe.each(PERSONAS)('the %s world', (persona) => {
  it.each(MOMENTS)('is valid when seeded at %i', (now) => {
    const world = seedWorld(persona, now);
    expect(world.persona).toBe(persona);
    expect(seedIsPartial(world)).toBe(false);
    expectValidWorld(world, now);
  });

  it('is the same every time it is seeded at the same moment', () => {
    expect(seedWorld(persona, NOW)).toStrictEqual(seedWorld(persona, NOW));
  });

  it('stands still: a tick right after seeding changes nothing', () => {
    const world = seedWorld(persona, NOW);
    expect(tickWorld(world, NOW, calendar)).toBe(world);
    expect(tickWorld(world, NOW + 60_000, calendar)).toBe(world);
  });
});

describe('the guest', () => {
  it('has nothing but the way in', () => {
    const world = seedWorld('guest', NOW);
    expect(world).toEqual(emptyWorld('guest'));
    expect(collectNextSteps(world, peekServiceDetail).map((step) => step.route)).toEqual(['/eligibility']);
  });
});

describe('the prospect', () => {
  const world = seedWorld('prospect', NOW);

  it('is a verified company with no plot and no request', () => {
    expect(world.company?.name).toEqual({ ar: 'شركة المثال للصناعات الغذائية ذ.م.م.', en: 'Al Mithal Food Industries W.L.L.' });
    expect(world.company?.cr).toBe('123456');
    expect(world.company?.signatory.name).toEqual({ ar: 'المفوَّض بالتوقيع (تجريبي)', en: 'Authorised signatory (demo)' });
    expect(world.company?.activity.en).toMatch(/food/i);
    expect(world.plots).toEqual([]);
    expect(world.requests).toEqual([]);
    expect(world.invoices).toEqual([]);
    expect(world.team.map((member) => member.scope)).toEqual(['owner']);
  });

  it('is asked for one thing: the eligibility check', () => {
    const steps = collectNextSteps(world, peekServiceDetail);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'start_service', route: '/eligibility' });
  });
});

describe('the tenant', () => {
  let world: World;
  beforeAll(() => {
    // Seeded here, not while the file is collected: the history needs the workflows to be in memory.
    world = seedWorld('tenant', NOW);
  });
  const plot = (number: string) => world.plots.find((candidate) => candidate.number === number);
  const leaseOf = (number: string) => world.leases.find((lease) => lease.plotId === plot(number)?.id);
  const requestsOf = (serviceId: string, number?: string) => world.requests.filter((request) => request.serviceId === serviceId && (number === undefined || request.plotId === plot(number)?.id));
  const laneOf = (request: RequestState) => (request.current === null ? null : (findStep(detailOf(request).workflow, request.current)?.lane ?? null));

  it('is an illustrative company with a small team', () => {
    expect(world.company?.name).toEqual({ ar: 'شركة المثال لتجارة قطع غيار السيارات ذ.م.م.', en: 'Al Mithal Auto Parts Trading W.L.L.' });
    expect(world.team.map((member) => member.scope)).toEqual(['owner', 'finance', 'engineering', 'operations']);
    for (const member of world.team) expect(`${member.name.ar} ${member.name.en}`).toMatch(/تجريبي.*demo/);
  });

  it('holds three assets at three stages', () => {
    expect(world.plots).toHaveLength(3);
    expect(plot('BA-214')).toMatchObject({ zoneCode: 'BA', areaSqm: 8000, solution: 'logistics', status: 'operating' });
    expect(plot('AW-131')).toMatchObject({ zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'building' });
    expect(plot('AK-OY-31')).toMatchObject({ zoneCode: 'AK', areaSqm: 5000, solution: 'openYard' });
  });

  it('has a 25-year lease on BA-214 at the published price, invoiced each quarter', () => {
    const lease = leaseOf('BA-214');
    expect(lease).toMatchObject({ ref: 'LC-2021-0318', ratePerSqmYear: 15, annualRent: 120_000, status: 'active' });
    expect(new Date(lease?.startsAt ?? 0).getFullYear()).toBe(2021);
    expect(new Date(lease?.endsAt ?? 0).getFullYear()).toBe(2046);
    const invoices = world.invoices.filter((invoice) => invoice.leaseId === lease?.id);
    expect(invoices.map((invoice) => invoice.amount)).toEqual([30_000, 30_000, 30_000]);
    expect(invoices.map((invoice) => invoice.status)).toEqual(['paid', 'paid', 'due']);
    const due = invoices[2];
    expect(due?.dueAt).toBe(NOW + 5 * DAY);
    expect(due?.title.en).toBe('Rent, Q4 2026 · BA-214');
    expect(due?.title.ar).toContain('إيجار الربع الرابع 2026');
  });

  it('signed the lease of AW-131 six weeks ago and has paid its way since', () => {
    const lease = leaseOf('AW-131');
    expect(lease).toMatchObject({ ratePerSqmYear: 15, annualRent: 75_000, status: 'active' });
    const weeks = (NOW - (lease?.startsAt ?? 0)) / (7 * DAY);
    expect(weeks).toBeGreaterThan(5.5);
    expect(weeks).toBeLessThan(6.5);
    const paid = world.invoices.filter((invoice) => invoice.status === 'paid').map((invoice) => invoice.amount);
    // The deposit and the first quarter: 5,000 m² × QAR 15 ÷ 4.
    expect(paid.filter((amount) => amount === 18_750)).toHaveLength(2);
  });

  it('has a one-year lease on the open yard that ends in about a hundred days', () => {
    const lease = leaseOf('AK-OY-31');
    expect(lease).toMatchObject({ ratePerSqmYear: 10, annualRent: 50_000, status: 'expiring' });
    const days = ((lease?.endsAt ?? 0) - NOW) / DAY;
    expect(days).toBeGreaterThan(98);
    expect(days).toBeLessThanOrEqual(100);
    expect(Math.round(((lease?.endsAt ?? 0) - (lease?.startsAt ?? 0)) / DAY)).toBe(364);
  });

  it('owes one invoice, due in five days', () => {
    const unpaid = world.invoices.filter((invoice) => invoice.status !== 'paid');
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0]).toMatchObject({ amount: 30_000, status: 'due', dueAt: NOW + 5 * DAY });
  });

  it('came to AW-131 through the whole application chain', () => {
    const chain = ['A4', 'A5', 'A6', 'A7', 'A8'].map((id) => requestsOf(id, 'AW-131')[0]);
    for (const request of chain) expect(request?.status).toBe('done');
    expect(new Set(chain.map((request) => request?.threadId)).size).toBe(1);
    expect(chain[1]?.parentId).toBe(chain[0]?.id);
    expect(chain[2]?.parentId).toBe(chain[1]?.id);
    expect(chain[3]?.parentId).toBe(chain[2]?.id);
    const times = chain.map((request) => request?.createdAt ?? 0);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('has the no-objection certificate, and the building permit is with a national entity', () => {
    const design = requestsOf('C1', 'AW-131')[0];
    expect(design?.status).toBe('done');
    const noc = world.docs.find((doc) => doc.kind === 'noc');
    expect(noc?.requestId).toBe(design?.id);
    expect(noc?.signed).toBe(true);

    const permit = requestsOf('C2', 'AW-131')[0] as RequestState;
    expect(permit.status).toBe('active');
    expect(laneOf(permit)).toBe('nat');
    expect(holdOf(permit)).toBeGreaterThan(NOW);
    expect(permit.createdAt).toBeGreaterThan(NOW - 2 * DAY);
  });

  it('has the Kahramaa connection open and the street light with the field team', () => {
    const utilities = requestsOf('C4', 'AW-131')[0] as RequestState;
    expect(['active', 'needs_you']).toContain(utilities.status);
    expect(utilities.parentId).toBe(requestsOf('A8', 'AW-131')[0]?.id);

    const light = requestsOf('D1', 'BA-214')[0] as RequestState;
    expect(light.status).toBe('active');
    expect(laneOf(light)).toBe('field');
    expect(light.form.category).toBe('lighting');
    expect(NOW - light.createdAt).toBeLessThan(2 * DAY);
  });

  it('has a renewal waiting to be accepted, signed and paid', () => {
    const renewal = requestsOf('B3', 'AK-OY-31')[0] as RequestState;
    expect(renewal.status).toBe('needs_you');
    expect(detailOf(renewal).actions.flatMap((action) => action.flow)).toEqual(expect.arrayContaining(['accept', 'sign', 'pay']));
    // The amount is on the request as soon as the step that asks for the payment is open.
    const action = detailOf(renewal).actions.find((candidate) => candidate.step === renewal.current);
    if (action?.flow.includes('pay')) expect(renewal.amount).toBe(50_000);
    // It opened 120 days before the lease ends.
    expect(Math.round(((leaseOf('AK-OY-31')?.endsAt ?? 0) - renewal.createdAt) / DAY)).toBe(120);
  });

  it('carries its papers in the wallet', () => {
    const kinds = world.docs.map((doc) => doc.kind);
    expect(kinds.filter((kind) => kind === 'contract').length).toBeGreaterThanOrEqual(2);
    expect(kinds).toContain('noc');
    expect(kinds).toContain('certificate');
    expect(kinds.filter((kind) => kind === 'receipt').length).toBeGreaterThanOrEqual(3);
    for (const lease of world.leases) expect(world.docs.some((doc) => doc.kind === 'contract' && doc.ref === lease.ref && doc.signed), `contract of ${lease.ref}`).toBe(true);
  });

  it('has one active contractor pass and one expired visitor pass', () => {
    expect(world.passes.map((pass) => `${pass.kind}:${pass.status}`).sort()).toEqual(['contractor:active', 'visitor:expired']);
  });

  it('has a handful of notifications, some of them unread', () => {
    expect(world.notifications.length).toBeGreaterThanOrEqual(4);
    expect(world.notifications.length).toBeLessThanOrEqual(10);
    const unread = world.notifications.filter((notification) => !notification.read).length;
    expect(unread).toBeGreaterThan(0);
    expect(unread).toBeLessThan(world.notifications.length);
    expect(new Set(world.notifications.map((notification) => notification.kind)).size).toBeGreaterThanOrEqual(3);
  });

  it('has one appointment ahead at the Business Services Center', () => {
    expect(world.appointments).toHaveLength(1);
    expect(world.appointments[0]?.status).toBe('booked');
    expect(world.appointments[0]?.at).toBeGreaterThan(NOW);
    expect(world.appointments[0]?.at).toBeLessThan(NOW + 4 * DAY);
  });

  it('keeps every seeded request in step with the published standard', () => {
    // Nothing in the demo opens on a request that is already late.
    for (const request of world.requests) {
      expect(request.createdAt, request.id).toBeGreaterThan(NOW - 60 * DAY);
      expect(request.visits.every((visit) => visit.enteredAt >= request.createdAt)).toBe(true);
    }
  });

  it('lets a held request go when time is fast-forwarded, and then it runs on', () => {
    const permit = requestsOf('C2', 'AW-131')[0] as RequestState;
    const live: Env = { detail: peekServiceDetail, timing: () => ({ duration: () => 1000 }) };
    const moved = fastForwardIn(world, permit.id, NOW + 1000, live);
    const after = moved.requests.find((request) => request.id === permit.id) as RequestState;
    expect(after.visits.length).toBe(permit.visits.length + 1);
    expect(after.visits[permit.visits.length - 1]?.doneAt).toBe(NOW + 1000);
    expect(holdOf(after)).toBeUndefined();
    // One step at a time: the next one takes its own time.
    expect(tickWorld(moved, NOW + 1500, live)).toBe(moved);
    const later = tickWorld(moved, NOW + 2000, live).requests.find((request) => request.id === permit.id) as RequestState;
    expect(later.visits.length).toBeGreaterThan(after.visits.length);
  });

  it('moves on by itself once the holds have passed', () => {
    const tomorrow = tickWorld(world, NOW + DAY + HOUR, calendar);
    const light = tomorrow.requests.find((request) => request.serviceId === 'D1') as RequestState;
    expect(light.status).toBe('needs_you');
    expect(detailOf(light).actions.find((action) => action.step === light.current)?.flow).toContain('rate');
    expect(tomorrow.notifications.length).toBeGreaterThan(world.notifications.length);
    expectValidWorld(tomorrow, NOW + DAY + HOUR);
  });
});
