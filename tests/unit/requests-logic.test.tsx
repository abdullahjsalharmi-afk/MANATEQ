import { describe, expect, it } from 'vitest';
import type { ActionAtom } from '@/data/types';
import type { RequestState } from '@/domain/types';
import { expectedChain, groupRequests, illustrativeAmount, offeredSlots, placeInThread, receiptRef, runnerTasks } from '@/features/requests/logic';
import { entityOf } from '@/features/requests/useRequestFacts';

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

  it('finds an amount when the request carries none', () => {
    expect(illustrativeAmount('rent', 200_000)).toBe(50_000);
    expect(illustrativeAmount('fee')).toBe(1_500);
    expect(illustrativeAmount(undefined)).toBeGreaterThan(0);
  });

  it('offers three times on working days', () => {
    const thursday = new Date(2026, 10, 26, 10).getTime();
    const slots = offeredSlots(thursday);
    expect(slots).toHaveLength(3);
    for (const at of slots) expect([5, 6]).not.toContain(new Date(at).getDay());
    expect(new Date(slots[0] as number).getDay()).toBe(0);
  });

  it('derives a receipt reference', () => {
    expect(receiptRef('MQ-2611-0085')).toBe('RC-2611-0085');
  });
});

describe('holder words', () => {
  it('names the entity behind a platform', () => {
    expect(entityOf('نظام رخص البناء الإلكتروني (وزارة البلدية)')).toBe('وزارة البلدية');
    expect(entityOf('Kahramaa')).toBe('Kahramaa');
  });
});
