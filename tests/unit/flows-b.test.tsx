import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail, ServiceId } from '@/data/types';
import { timingFor } from '@/domain/simulation';
import type { RequestState, World } from '@/domain/types';
import { alertedParties, incidentIcon } from '@/features/flows/incident/alerted';
import { initialPlotId } from '@/features/flows/maintenance/parts/plots';
import { categoryIcon, stageStates, trackStage, type TrackStage } from '@/features/flows/maintenance/track';
import { passKinds } from '@/features/flows/pass/kinds';
import { isQid, customRange, endOfLocalDay, idOrPlateOf, missingDetails, quickRange, startOfLocalDay } from '@/features/flows/pass/validity';
import { emptyWorld } from '@/state/seed';
import { issuePassIn, startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';

const files = import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true });
const all: ServiceDetail[] = Object.values(files).flatMap((m) => m.default);
const detail = (id: ServiceId): ServiceDetail => all.find((s) => s.id === id) as ServiceDetail;

const NOW = new Date(2026, 10, 25, 9, 30).getTime();
const DAY = 24 * 60 * 60 * 1000;
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const base: World = {
  ...emptyWorld('tenant'),
  plots: [{ id: 'BA-121', number: 'BA-121', zoneCode: 'BA', areaSqm: 10000, solution: 'logistics', status: 'operating', leaseId: 'l1' }],
};

beforeAll(async () => {
  await loadAllServiceDetails();
});

describe('D1 tracker', () => {
  const at = (current: number | null, status: RequestState['status'] = 'active') => trackStage(detail('D1').workflow, { current, status });

  it('maps the real D1 workflow onto received → scheduled → on site → done', () => {
    expect([2, 3, 4, 5].map((step) => at(step))).toEqual(['received', 'received', 'received', 'received']);
    expect([6, 7].map((step) => at(step))).toEqual(['scheduled', 'scheduled']);
    expect(at(8)).toBe('onSite');
    expect(at(9)).toBe('onSite');
    expect(at(10)).toBe('scheduled');
    expect(at(11, 'needs_you')).toBe('done');
    expect(at(null, 'done')).toBe('done');
  });

  it('moves forward only while a live report runs to its rating', () => {
    let { world, id } = startIn(base, { serviceId: 'D1', plotId: 'BA-121', form: { category: 'lighting', location: 'BA-121' } }, NOW, live);
    const seen: TrackStage[] = [];
    let now = NOW;
    const order = ['received', 'scheduled', 'onSite', 'done'];
    for (let i = 0; i < 3000; i++) {
      const request = world.requests.find((r) => r.id === id) as RequestState;
      const stage = trackStage(detail('D1').workflow, request);
      if (seen[seen.length - 1] !== stage) seen.push(stage);
      if (request.status === 'needs_you' || request.status === 'done') break;
      now += 200;
      world = tickWorld(world, now, live);
    }
    expect(seen[0]).toBe('received');
    expect(seen[seen.length - 1]).toBe('done');
    expect(seen.map((s) => order.indexOf(s))).toEqual([...seen.map((s) => order.indexOf(s))].sort());
  });

  it('marks the stages behind as done and the one reached as current', () => {
    expect(stageStates('scheduled')).toEqual({ received: 'done', scheduled: 'current', onSite: 'upcoming', done: 'upcoming' });
    expect(stageStates('done').done).toBe('done');
  });

  it('has a glyph for every D1 category', () => {
    const options = detail('D1').fields.find((f) => f.key === 'category')?.options ?? [];
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(categoryIcon(option.value)).toBeTruthy();
  });
});

describe('plot preselection', () => {
  const plots = [
    { id: 'BA-121', number: 'BA-121' },
    { id: 'AW-116', number: 'AW-116' },
  ];
  it('takes ?plot= when it is the investor’s, the only plot otherwise, or none', () => {
    expect(initialPlotId(plots, 'AW-116')).toBe('AW-116');
    expect(initialPlotId(plots, 'XX-1')).toBeNull();
    expect(initialPlotId(plots, undefined)).toBeNull();
    expect(initialPlotId([plots[0]!], undefined)).toBe('BA-121');
    expect(initialPlotId([], undefined)).toBeNull();
  });
});

describe('D2 pass', () => {
  it('offers exactly the pass types of the data', () => {
    expect(passKinds(detail('D2')).map((k) => k.kind)).toEqual(['worker', 'vehicle', 'visitor']);
  });

  it('turns quick picks into whole local days from today', () => {
    const today = quickRange('today', NOW);
    expect(today.from).toBe(startOfLocalDay(NOW));
    expect(today.to).toBe(endOfLocalDay(startOfLocalDay(NOW)));
    const week = quickRange('week', NOW);
    expect(new Date(week.to).getDate()).toBe(new Date(NOW + 6 * DAY).getDate());
    expect(quickRange('month', NOW).to).toBeGreaterThan(quickRange('days3', NOW).to);
  });

  it('checks custom dates', () => {
    expect(customRange(null, NOW, NOW)).toBe('missing');
    expect(customRange(NOW - 2 * DAY, NOW, NOW)).toBe('past');
    expect(customRange(NOW + 2 * DAY, NOW + DAY, NOW)).toBe('order');
    const range = customRange(NOW, NOW + 2 * DAY, NOW);
    expect(range).toEqual({ from: startOfLocalDay(NOW), to: endOfLocalDay(NOW + 2 * DAY) });
  });

  it('asks each type only for what it needs', () => {
    const empty = { name: '', qid: '', plate: '', company: '', phone: '' };
    expect(missingDetails('worker', empty)).toEqual(['name', 'qid']);
    expect(missingDetails('vehicle', { ...empty, name: 'Ali' })).toEqual(['plate']);
    // A visitor receives the pass by message: the mobile number is asked (gate n=19).
    expect(missingDetails('visitor', { ...empty, name: 'Sara' })).toEqual(['phone']);
    expect(missingDetails('visitor', { ...empty, name: 'Sara', phone: '12' })).toEqual(['phone']);
    expect(missingDetails('visitor', { ...empty, name: 'Sara', phone: '+974 5512 3456' })).toEqual([]);
    expect(idOrPlateOf('vehicle', { ...empty, plate: ' 12345 q ' })).toBe('12345 Q');
    expect(idOrPlateOf('visitor', { ...empty, qid: '1' })).toBeUndefined();
  });

  it('takes a worker’s personal ID number only as eleven digits (last look)', () => {
    const worker = { name: 'Ali', qid: '', plate: '', company: '', phone: '' };
    for (const qid of ['abc', 'سارة', '123', '2876341234', '287634123456', '2876341234a']) expect([qid, missingDetails('worker', { ...worker, qid })]).toEqual([qid, ['qid']]);
    for (const qid of ['28763412345', ' 287 6341 2345 ']) expect([qid, missingDetails('worker', { ...worker, qid })]).toEqual([qid, []]);
    expect(isQid('28763412345')).toBe(true);
    // What is printed on the pass is the number without its spaces.
    expect(idOrPlateOf('worker', { ...worker, qid: ' 287 6341 2345 ' })).toBe('28763412345');
  });

  it('issues the pass once: the D2 request finds it and adds no second one', () => {
    const range = quickRange('today', NOW);
    const issued = issuePassIn(base, { kind: 'visitor', holder: 'Sara', plotId: 'BA-121', from: range.from, to: range.to }, NOW);
    let { world } = startIn(
      issued.world,
      { serviceId: 'D2', plotId: 'BA-121', form: { passType: 'visitor', holder: 'Sara', visitor: { name: 'Sara' }, validFrom: range.from, validTo: range.to, plot: 'BA-121' } },
      NOW,
      live,
    );
    for (let i = 1; i <= 600; i++) world = tickWorld(world, NOW + i * 200, live);
    const request = world.requests.find((r) => r.serviceId === 'D2') as RequestState;
    expect(request.current === null || request.current > 8).toBe(true);
    expect(world.passes.filter((pass) => pass.holder === 'Sara')).toHaveLength(1);
    expect(world.passes[0]?.status).toBe('active');
  });
});

describe('D3 emergency', () => {
  it('names who the workflow alerts; Civil Defence at once for a fire only', () => {
    const workflow = detail('D3').workflow;
    expect(alertedParties(workflow, 'fire')).toEqual([
      { party: 'control', when: 'now' },
      { party: 'responders', when: 'now' },
      { party: 'civilDefence', when: 'now' },
    ]);
    expect(alertedParties(workflow, 'security').find((a) => a.party === 'civilDefence')?.when).toBe('ifNeeded');
  });

  it('has a glyph for every incident type of the data', () => {
    for (const option of detail('D3').fields.find((f) => f.key === 'type')?.options ?? []) expect(incidentIcon(option.value)).toBeTruthy();
  });
});
