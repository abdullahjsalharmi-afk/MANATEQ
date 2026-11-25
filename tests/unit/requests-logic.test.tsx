import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ActionAtom, ServiceDetail } from '@/data/types';
import { timingFor } from '@/domain/simulation';
import type { RequestState } from '@/domain/types';
import { depositPaidWithOffer, expectedChain, groupRequests, hasDayClock, newReceipts, offeredSlots, passOfRequest, placeInThread, runnerTasks } from '@/features/requests/logic';
import { entityOf, nationalHolder } from '@/features/requests/useRequestFacts';
import { seedWorld } from '@/state/seed';
import { actIn, startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';

const NOW = new Date(2026, 10, 19, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };

beforeAll(async () => {
  await loadAllServiceDetails();
});

const req = (id: string, serviceId: string, threadId: string, createdAt: number, status: RequestState['status'] = 'done', updatedAt = createdAt): RequestState => ({
  id,
  ref: `MQ-${id}`,
  serviceId,
  threadId,
  createdAt,
  updatedAt,
  form: {},
  visits: [],
  current: null,
  status,
  investorMs: 0,
  docIds: [],
});

describe('threads', () => {
  it('knows the land chain from application to connection', () => {
    expect(expectedChain('A4')).toEqual(['A4', 'A5', 'A6', 'A7', 'B2', 'A8', 'C4']);
  });

  it('places a request in its chain', () => {
    const thread = [req('a', 'A4', 't', 1), req('b', 'A5', 't', 2), req('c', 'A6', 't', 3, 'active')];
    expect(placeInThread(thread[2] as RequestState, thread)).toEqual({ rootServiceId: 'A4', position: 3, total: 7 });
  });

  it('groups a thread into one card, the latest stage on top, waiting requests first', () => {
    const all = [req('a', 'A4', 't', 1), req('b', 'A5', 't', 2), req('x', 'B8', 'x', 5, 'done', 50), req('y', 'B3', 'y', 4, 'needs_you', 10)];
    const done = all.filter((r) => r.status === 'done');
    const groups = groupRequests(done, all);
    expect(groups.map((g) => g.top.id)).toEqual(['x', 'b']);
    expect(groups[1]?.rest.map((r) => r.id)).toEqual(['a']);
    expect(groups[1]?.place?.position).toBe(2);
    expect(groups[0]?.place).toBeUndefined();

    const mixed = groupRequests(all, all);
    expect(mixed[0]?.top.id).toBe('y');
  });
});

describe('the action runner', () => {
  const tasksFor = (choice: string | undefined): ActionAtom[] => (choice === 'deposit' ? ['pay'] : ['upload']);

  it('runs a plain flow in order', () => {
    expect(runnerTasks({ flow: ['accept', 'sign', 'pay'] }, undefined, tasksFor)).toEqual(['accept', 'sign', 'pay']);
  });

  it('asks for the choice first, then only what the choice needs', () => {
    const action = { flow: ['choose', 'upload', 'pay'] as ActionAtom[], options: [{ value: 'deposit', ar: 'إيداع', en: 'Deposit' }] };
    expect(runnerTasks(action, undefined, tasksFor)).toEqual(['choose']);
    expect(runnerTasks(action, 'deposit', tasksFor)).toEqual(['choose', 'pay']);
    expect(runnerTasks(action, 'guarantee', tasksFor)).toEqual(['choose', 'upload']);
  });


  it('offers three times on working days', () => {
    const thursday = new Date(2026, 10, 26, 10).getTime();
    const slots = offeredSlots(thursday);
    expect(slots).toHaveLength(3);
    for (const at of slots) expect([5, 6]).not.toContain(new Date(at).getDay());
    expect(new Date(slots[0] as number).getDay()).toBe(0);
  });

  it('names the receipts a payment really filed, not one derived from the request', () => {
    let tenant = seedWorld('tenant', NOW);
    const renewal = tenant.requests.find((request) => request.serviceId === 'B3' && request.status === 'needs_you');
    // The seeded renewal may still be replaying; tick it to its waiting step.
    tenant = tickWorld(tenant, NOW + 1000, live);
    const waiting = tenant.requests.find((request) => request.id === renewal?.id) as RequestState;
    expect(waiting).toMatchObject({ status: 'needs_you' });
    expect(waiting.amount).toBeGreaterThan(0);
    const before = waiting.docIds;
    tenant = actIn(tenant, waiting.id, { form: {} }, NOW + 2000, live);
    const after = tenant.requests.find((request) => request.id === waiting.id)?.docIds ?? [];
    const receipts = newReceipts(before, after, tenant.docs);
    expect(receipts).toHaveLength(1);
    const invoice = tenant.invoices.find((candidate) => candidate.receiptDocId === receipts[0]?.id);
    expect(receipts[0]?.ref).toBe(invoice?.ref.replace(/^INV-/, 'RCP-'));
    expect(receipts[0]?.ref).not.toContain(waiting.ref.replace(/^MQ-/, ''));
  });

  it('knows a deposit paid with the offer and asks for no second payment', () => {
    let tenant = seedWorld('tenant', NOW);
    const earlier = tenant.requests.find((request) => request.serviceId === 'B2') as RequestState;
    const again = startIn(tenant, { serviceId: 'B2', plotId: 'AW-116', threadId: earlier.threadId }, NOW + 1000, live);
    tenant = tickWorld(again.world, NOW + 60_000, live);
    const waiting = tenant.requests.find((request) => request.id === again.id) as RequestState;
    const action = (peekServiceDetail('B2') as ServiceDetail).actions.find((candidate) => candidate.step === 3);
    expect(action).toBeDefined();
    const thread = tenant.requests.filter((request) => request.threadId === waiting.threadId);
    const prepaid = action ? depositPaidWithOffer(waiting, action, thread, tenant.docs) : null;
    expect(prepaid?.receipt?.ref).toMatch(/^RCP-/);
    // A request that has its own amount pays it.
    expect(action ? depositPaidWithOffer({ ...waiting, amount: 18_750 }, action, thread, tenant.docs) : 'x').toBeNull();
    // Without an offer in the thread nothing was paid before.
    expect(action ? depositPaidWithOffer(waiting, action, [waiting], tenant.docs) : 'x').toBeNull();
  });
});

describe('the clock of a request', () => {
  const clock = { ratio: 0.1, targetDays: 5 };
  it('shows a day clock only for a duration that covers the whole request', () => {
    expect(hasDayClock('C4', clock)).toBe(true);
    expect(hasDayClock('C2', { ratio: 0.01, targetDays: 1 })).toBe(false);
    expect(hasDayClock('D1', { ratio: null, targetDays: 0 })).toBe(false);
    expect(hasDayClock('B3', { ratio: null, targetDays: null })).toBe(false);
    expect(hasDayClock('A5', undefined)).toBe(false);
  });
});

describe('issued passes', () => {
  it('finds the pass a gate-pass request issued', () => {
    const world = seedWorld('tenant', NOW);
    const request = world.requests.find((candidate) => candidate.serviceId === 'D2' && candidate.status === 'done');
    expect(request).toBeDefined();
    const pass = request ? passOfRequest(request, world.passes) : undefined;
    expect(pass?.kind).toBe('worker');
    expect(passOfRequest({ ...(request as RequestState), serviceId: 'D1' }, world.passes)).toBeUndefined();
  });
});

describe('holder words', () => {
  it('names the entity behind a platform', () => {
    expect(entityOf('نظام رخص البناء الإلكتروني (وزارة البلدية)')).toBe('وزارة البلدية');
    expect(entityOf('Kahramaa')).toBe('Kahramaa');
  });

  it('names the same entity in both languages', () => {
    const permits = { ar: 'نظام رخص البناء الإلكتروني (وزارة البلدية)', en: 'Ministry of Municipality permits' };
    expect(nationalHolder(permits, 'ar')).toEqual({ headline: 'وزارة البلدية', phrase: 'وزارة البلدية' });
    expect(nationalHolder(permits, 'en')).toEqual({ headline: 'Ministry of Municipality', phrase: 'the Ministry of Municipality' });
    const customs = { ar: 'الهيئة العامة للجمارك (النديب)', en: 'Customs (Al Nadeeb)' };
    expect(nationalHolder(customs, 'ar').headline).toBe('الهيئة العامة للجمارك');
    expect(nationalHolder(customs, 'en').headline).toBe('Customs');
    expect(nationalHolder({ ar: 'كهرماء', en: 'Kahramaa' }, 'en').phrase).toBe('Kahramaa');
  });
});
