import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ActionAtom, ServiceDetail } from '@/data/types';
import { timingFor } from '@/domain/simulation';
import type { RequestState } from '@/domain/types';
import { expectedChain, groupRequests, hasDayClock, offeredSlots, placeInThread, runnerTasks } from '@/features/requests/logic';
import { nationalHolder, withoutBrackets } from '@/features/requests/useRequestFacts';
import { seedWorld } from '@/state/seed';
import { startIn, stepTasks, tickWorld } from '@/state/sim';
import { holderOf } from '@/state/view';
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

  it('knows a deposit paid with the offer and asks for no second payment', () => {
    let tenant = seedWorld('tenant', NOW);
    const earlier = tenant.requests.find((request) => request.serviceId === 'B2') as RequestState;
    const again = startIn(tenant, { serviceId: 'B2', plotId: 'AW-116', threadId: earlier.threadId }, NOW + 1000, live);
    tenant = tickWorld(again.world, NOW + 60_000, live);
    const waiting = tenant.requests.find((request) => request.id === again.id) as RequestState;
    const action = (peekServiceDetail('B2') as ServiceDetail).actions.find((candidate) => candidate.step === 3);
    expect(action).toBeDefined();
    expect(waiting.prepaidDocId).toBeDefined();
    expect(tenant.docs.find((doc) => doc.id === waiting.prepaidDocId)?.ref).toMatch(/^RCP-/);
    // The runner asks for the choice, and choosing the deposit asks for nothing more.
    const tasks = (choice: string | undefined) => (action ? runnerTasks(action, choice, (picked) => stepTasks('B2', action, picked, waiting)) : []);
    expect(tasks('deposit')).toEqual(['choose']);
    expect(tasks('guarantee')).toContain('upload');
  });
});

describe('the clock of a request', () => {
  it('shows a day clock only for a standard with a duration', () => {
    expect(hasDayClock({ ratio: 0.1, targetDays: 5 })).toBe(true);
    expect(hasDayClock({ ratio: null, targetDays: 0 })).toBe(false);
    expect(hasDayClock({ ratio: null, targetDays: null })).toBe(false);
    expect(hasDayClock(undefined)).toBe(false);
  });

  it('has no day clock for the building permit, whose standard is per Ministry event', () => {
    const permit = peekServiceDetail('C2') as ServiceDetail;
    expect(permit.standard.value).toBeNull();
  });
});

describe('holder words', () => {
  const ar = (text: { ar: string }) => text.ar;
  const en = (text: { en: string }) => text.en;

  it('names the same entity in both languages', () => {
    const permits = holderOf({ lane: 'nat', enablers: ['I9'] });
    expect(nationalHolder(permits, ar)).toEqual({ headline: 'وزارة البلدية', phrase: 'وزارة البلدية' });
    expect(nationalHolder(permits, en)).toEqual({ headline: 'Ministry of Municipality', phrase: 'the Ministry of Municipality' });
    const customs = holderOf({ lane: 'nat', enablers: ['I13'] });
    expect(nationalHolder(customs, ar).headline).toBe('الهيئة العامة للجمارك');
    expect(nationalHolder(customs, en).headline).toBe('General Authority of Customs');
  });

  it('falls back to the platform name without a bracketed system name', () => {
    expect(nationalHolder({ name: { ar: 'منصة (س)', en: 'Platform (S)' } }, en)).toEqual({ headline: 'Platform', phrase: 'Platform' });
    expect(withoutBrackets('Kahramaa')).toBe('Kahramaa');
  });
});
