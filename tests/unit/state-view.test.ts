import { beforeAll, describe, expect, it } from 'vitest';
import { langTools } from '@/app/i18n';
import { getIntegration, loadAllServiceDetails, peekServiceDetail, reference } from '@/data/catalog';
import type { ServiceDetail, ServiceId } from '@/data/types';
import { DAY_MS, standardDays, timingFor } from '@/domain/simulation';
import { CLOCK_WARN_RATIO } from '@/domain/standard';
import type { RequestState, World } from '@/domain/types';
import { findStep, mainPath, waitsForInvestor } from '@/domain/workflow';
import { calendarTiming, emptyWorld, seedWorld } from '@/state/seed';
import { actIn, cancelIn, startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';
import { holderNameOf, requestView, standardClockOf, timelineRows } from '@/state/view';

const files = import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true });
const all: ServiceDetail[] = Object.values(files).flatMap((m) => m.default);
const detail = (id: ServiceId): ServiceDetail => all.find((s) => s.id === id) as ServiceDetail;

const NOW = new Date(2026, 10, 19, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const calendar: Env = { detail: peekServiceDetail, timing: calendarTiming };
const base: World = { ...emptyWorld('tenant'), plots: [{ id: 'p1', number: 'AW-117', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'operating' }] };

beforeAll(async () => {
  await loadAllServiceDetails();
});

/** Runs one request of a service on demo time, acting for the investor at once, and reports the clock along the way. */
function runLive(serviceId: ServiceId): { request: RequestState; peak: number; finishedAt: number } {
  const service = detail(serviceId);
  let { world, id } = startIn(base, { serviceId, plotId: 'p1' }, NOW, live);
  let peak = 0;
  let now = NOW;
  const read = () => world.requests.find((request) => request.id === id) as RequestState;
  for (let i = 0; i < 4000 && read().current !== null; i++) {
    now += 100;
    world = tickWorld(world, now, live);
    if (read().status === 'needs_you') world = actIn(world, id, { rating: 5 }, now, live);
    const ratio = standardClockOf(read(), service, now, 1).ratio;
    if (ratio !== null) peak = Math.max(peak, ratio);
  }
  return { request: read(), peak, finishedAt: now };
}

describe('the service-standard clock', () => {
  it.each(all.map((service) => [service.id] as const))('keeps the usual path of %s inside its published standard', (id) => {
    const service = detail(id);
    const { request, peak } = runLive(id);
    expect(request.status).toBe('done');
    const clock = standardClockOf(request, service, NOW + 3_600_000, 1);
    expect(clock.targetDays).toBe(standardDays(service.standard));
    if (clock.targetDays !== null && clock.targetDays > 0) {
      expect(clock.ratio).not.toBeNull();
      // The usual path never looks late, at the end or on the way.
      expect(clock.ratio as number).toBeLessThanOrEqual(CLOCK_WARN_RATIO + 1e-9);
      expect(peak).toBeLessThanOrEqual(CLOCK_WARN_RATIO + 1e-9);
    } else {
      expect(clock.ratio).toBeNull();
    }
    expect(clock.dayNumber).toBeGreaterThanOrEqual(1);
    expect(clock.usedDays).toBeGreaterThanOrEqual(0);
  });

  it('does not run while the investor holds the request', () => {
    const service = detail('A6');
    let { world, id } = startIn(base, { serviceId: 'A6', plotId: 'p1' }, NOW, live);
    const read = () => world.requests.find((request) => request.id === id) as RequestState;
    let now = NOW;
    for (let i = 0; i < 6000 && read().status !== 'needs_you'; i++) world = tickWorld(world, (now += 100), live);
    expect(read().status).toBe('needs_you');
    const before = standardClockOf(read(), service, now, 1).usedDays;
    expect(standardClockOf(read(), service, now + 30 * 86_400_000, 1).usedDays).toBe(before);
  });

  it('grows with the open step and counts a finished step in full', () => {
    // Any service whose usual path has a step that takes days will do; the first one in the catalogue.
    const lasting = (service: ServiceDetail) =>
      mainPath(service.workflow)
        .map((stepId) => findStep(service.workflow, stepId))
        .find((step) => step !== undefined && !waitsForInvestor(step) && step.kind !== 'gate' && timingFor(service, 1).duration(step) > 2000);
    const service = all.find((candidate) => lasting(candidate) !== undefined) as ServiceDetail;
    const target = lasting(service)!;
    const timing = timingFor(service, 1);
    let { world, id } = startIn(base, { serviceId: service.id, plotId: 'p1' }, NOW, live);
    const read = () => world.requests.find((request) => request.id === id) as RequestState;
    let now = NOW;
    for (let i = 0; i < 6000 && read().current !== target.id; i++) {
      now += 100;
      world = tickWorld(world, now, live);
      if (read().status === 'needs_you') world = actIn(world, id, { rating: 5 }, now, live);
    }
    expect(read().current).toBe(target.id);
    const open = read().visits[read().visits.length - 1]!;
    const duration = timing.duration(target);
    const days = duration / DAY_MS;
    const atStart = standardClockOf(read(), service, open.enteredAt, 1).usedDays;
    const halfway = standardClockOf(read(), service, open.enteredAt + duration / 2, 1).usedDays;
    expect(halfway - atStart).toBeCloseTo(days / 2, 5);
    world = tickWorld(world, open.enteredAt + duration, live);
    expect(read().current).not.toBe(target.id);
    expect(standardClockOf(read(), service, open.enteredAt + duration, 1).usedDays - atStart).toBeCloseTo(days, 5);
  });

  it('reads a seeded request in real days, not in demo seconds', () => {
    const tenant = seedWorld('tenant', NOW);
    const utilities = tenant.requests.find((request) => request.serviceId === 'C4') as RequestState;
    const clock = standardClockOf(utilities, detail('C4'), NOW, 1);
    // Weeks have passed since it opened; the standard counts the working days Manateq took.
    expect(NOW - utilities.createdAt).toBeGreaterThan(20 * 86_400_000);
    expect(clock.usedDays).toBeLessThan(clock.targetDays as number);
    expect(clock.ratio as number).toBeLessThanOrEqual(CLOCK_WARN_RATIO);
    for (const request of tenant.requests) {
      const ratio = standardClockOf(request, detail(request.serviceId), NOW, 1).ratio;
      if (ratio !== null) expect(ratio, `${request.serviceId} opens the demo late`).toBeLessThanOrEqual(CLOCK_WARN_RATIO);
    }
  });
});

describe('who holds a step', () => {
  it('names a national step after the first platform it uses', () => {
    for (const service of all) {
      for (const step of service.workflow.steps.filter((candidate) => candidate.lane === 'nat')) {
        const integration = step.enablers.find((id) => id.startsWith('I'));
        const expected = (integration ? getIntegration(integration)?.short : undefined) ?? reference.lanes.nat.short;
        expect(holderNameOf(step), `${service.id} step ${step.id}`).toEqual(expected);
      }
    }
    expect(holderNameOf({ lane: 'nat', enablers: ['P7', 'I11'] })).toEqual(getIntegration('I11')?.short);
    expect(holderNameOf({ lane: 'nat', enablers: [] })).toEqual(reference.lanes.nat.short);
  });

  it('names the others by their lane, and the investor as "you"', () => {
    expect(holderNameOf({ lane: 'inv', enablers: [] })).toEqual({ ar: 'أنت', en: 'You' });
    expect(holderNameOf({ lane: 'staff', enablers: ['I22'] })).toEqual(reference.lanes.staff.short);
    expect(holderNameOf({ lane: 'field', enablers: [] })).toEqual(reference.lanes.field.short);
  });
});

describe('the view of a request', () => {
  it('shows the building permit with the national entity that has it', () => {
    const tenant = seedWorld('tenant', NOW);
    const permit = tenant.requests.find((request) => request.serviceId === 'C2') as RequestState;
    const service = detail('C2');
    const view = requestView(permit, service, NOW, 1);
    expect(view.status).toBe('active');
    expect(view.holder?.lane).toBe('nat');
    expect(view.holder?.name).toEqual(holderNameOf(view.currentStep!));
    expect(view.pendingAction).toBeNull();
    expect(view.progress).toBeGreaterThan(0);
    expect(view.progress).toBeLessThan(1);
    expect(view.heldSince).toBeLessThan(NOW);
    expect(view.expectedAt).toBeGreaterThan(NOW);
    expect(view.finishedAt).toBeUndefined();

    // Done steps, then the open one, then the usual way to the end.
    const states = view.timeline.map((item) => item.state);
    const current = states.indexOf('current');
    expect(states.filter((state) => state === 'current')).toHaveLength(1);
    expect(states.slice(0, current).every((state) => state === 'done')).toBe(true);
    expect(states.slice(current + 1).every((state) => state === 'upcoming')).toBe(true);
    expect(states.slice(current + 1).length).toBeGreaterThan(0);
    expect(view.timeline[current]?.step).toBe(permit.current);
    expect(view.timeline[current]?.time).toBe(view.expectedAt);
    expect(view.timeline[view.timeline.length - 1]?.kind).toBe('end');
    expect(new Set(view.timeline.map((item) => item.id)).size).toBe(view.timeline.length);
    for (const item of view.timeline.filter((candidate) => candidate.state === 'done')) expect(item.time).toBeLessThanOrEqual(NOW);
    for (const item of view.timeline.filter((candidate) => candidate.state === 'upcoming')) expect(item.time).toBeUndefined();
    // Decisions that were taken show which way they went.
    for (const item of view.timeline.filter((candidate) => candidate.kind === 'gate' && candidate.state === 'done')) expect(item.outcome).toBeDefined();
    // The walk behind and the path ahead make up the usual path of the workflow.
    expect(view.timeline.map((item) => item.step)).toEqual(mainPath(service.workflow));
  });

  it('names the Ministry behind the permit platform, and has no day count for a per-event standard', () => {
    const tenant = seedWorld('tenant', NOW);
    const permit = tenant.requests.find((request) => request.serviceId === 'C2') as RequestState;
    const view = requestView(permit, detail('C2'), NOW, 1);
    expect(view.holder?.entity?.name).toEqual({ ar: 'وزارة البلدية', en: 'Ministry of Municipality' });
    expect(view.holder?.entity?.inText.en).toBe('the Ministry of Municipality');
    // "Status updated within one working day of each Ministry event" is a promise per event, not a deadline.
    expect(view.clock.targetDays).toBeNull();
    expect(view.clock.ratio).toBeNull();
    expect(view.focus?.step.id).toBe(permit.current);
    expect(view.focus?.expectedAt).toBe(view.expectedAt);
  });

  it('never puts a decision or a step that runs by itself in the headline', () => {
    for (const service of all) {
      for (const step of service.workflow.steps.filter((candidate) => candidate.kind === 'gate' || candidate.kind === 'auto')) {
        const request: RequestState = {
          id: 'r1', ref: 'MQ-2611-0001', serviceId: service.id, threadId: 'r1', createdAt: NOW - DAY_MS, updatedAt: NOW, form: {},
          visits: [{ step: step.id, enteredAt: NOW - 1000 }], current: step.id, status: 'active', investorMs: 0, docIds: [],
        };
        const focus = requestView(request, service, NOW, 1).focus;
        if (!focus) continue;
        expect(['gate', 'end', 'stop'], `${service.id} step ${step.id}`).not.toContain(focus.step.kind);
        if (focus.step.kind === 'auto') expect(focus.step.lane, `${service.id} step ${step.id}`).toBe('nat');
      }
    }
  });

  it('hands the investor the action when the request waits for them', () => {
    const tenant = seedWorld('tenant', NOW);
    const renewal = tenant.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const view = requestView(renewal, detail('B3'), NOW, 1);
    expect(view.holder).toEqual({ lane: 'inv', name: { ar: 'أنت', en: 'You' } });
    expect(view.pendingAction?.step).toBe(renewal.current);
    expect(view.pendingAction?.flow).toContain('pay');
    expect(view.expectedAt).toBeUndefined();
    expect(view.currentStep && waitsForInvestor(view.currentStep)).toBe(true);
  });

  it('closes a finished request: no holder, full progress, only what happened', () => {
    const tenant = seedWorld('tenant', NOW);
    const design = tenant.requests.find((request) => request.serviceId === 'C1') as RequestState;
    const view = requestView(design, detail('C1'), NOW, 1);
    expect(view).toMatchObject({ status: 'done', holder: null, currentStep: null, pendingAction: null, progress: 1 });
    expect(view.finishedAt).toBe(design.updatedAt);
    expect(view.timeline.every((item) => item.state === 'done')).toBe(true);
    expect(view.timeline).toHaveLength(design.visits.length);

    const withdrawn = cancelIn(tenant, tenant.requests.find((request) => request.serviceId === 'B3')!.id, NOW + 1000, calendar);
    const stopped = withdrawn.requests.find((request) => request.serviceId === 'B3') as RequestState;
    const stoppedView = requestView(stopped, detail('B3'), NOW + 2000, 1);
    expect(stoppedView).toMatchObject({ status: 'stopped', holder: null, pendingAction: null });
    expect(stoppedView.timeline.every((item) => item.state === 'done')).toBe(true);
  });

  it('shows a request that could not start yet as received by the app, with its whole path ahead', () => {
    const queued = startIn(base, { serviceId: 'D1', plotId: 'p1' }, NOW, { detail: () => undefined, timing: live.timing });
    const request = queued.world.requests[0] as RequestState;
    expect(request).toMatchObject({ visits: [], current: null, status: 'active' });
    const view = requestView(request, detail('D1'), NOW, 1);
    expect(view.holder?.lane).toBe('one');
    expect(view.timeline.map((item) => item.step)).toEqual(mainPath(detail('D1').workflow));
    expect(view.timeline.every((item) => item.state === 'upcoming')).toBe(true);
    // It starts as soon as its workflow is in memory, from the moment it was created.
    const started = tickWorld(queued.world, NOW + 5000, live).requests[0] as RequestState;
    expect(started.visits[0]?.enteredAt).toBe(NOW);
    expect(started.visits.length).toBeGreaterThan(1);
  });

  it('turns the timeline into rows for the screen, in either language', () => {
    const tenant = seedWorld('tenant', NOW);
    const permit = tenant.requests.find((request) => request.serviceId === 'C2') as RequestState;
    const view = requestView(permit, detail('C2'), NOW, 1);
    for (const lang of ['ar', 'en'] as const) {
      const tools = langTools(lang);
      const rows = timelineRows(view.timeline, tools, NOW);
      expect(rows).toHaveLength(view.timeline.length);
      rows.forEach((row, index) => {
        const item = view.timeline[index]!;
        expect(row.title).toBe(tools.pick(item.title));
        expect(row.state).toBe(item.state);
        expect(row.lane).toBe(item.lane);
        if (item.lane === 'nat') expect(row.holderName).toBe(tools.pick(item.holderName));
        else expect(row.holderName).toBeUndefined();
        if (item.state === 'done') expect(row.time).toBeTruthy();
        if (item.outcome) expect(row.outcome).toBe(tools.pick(item.outcome === 'yes' ? { ar: 'نعم', en: 'Yes' } : { ar: 'لا', en: 'No' }));
      });
    }
    // Today's steps show the time; older ones the date.
    const rows = timelineRows(view.timeline, langTools('en'), NOW);
    const design = tenant.requests.find((request) => request.serviceId === 'C1') as RequestState;
    const old = timelineRows(requestView(design, detail('C1'), NOW, 1).timeline, langTools('en'), NOW);
    expect(rows[0]?.time).toMatch(/\d{1,2}:\d{2}/);
    expect(old[0]?.time).toMatch(/Nov|Oct/);
  });
});
