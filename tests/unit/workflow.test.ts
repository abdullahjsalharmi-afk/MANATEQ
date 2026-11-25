import { describe, expect, it } from 'vitest';
import type { ServiceDetail, WorkflowStep } from '@/data/types';
import { DOMAIN_CODES } from '@/data/catalog';
import type { RequestState } from '@/domain/types';
import { act, advance, begin, fastForward, findStep, mainPath, progress, reachable, serviceClockMs, waitsForInvestor, type Timing } from '@/domain/workflow';
import { pathScale, standardDays, stepDays, timingFor } from '@/domain/simulation';
import { durationText, standardHeadline } from '@/domain/standard';

const files = import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true });
const all: ServiceDetail[] = Object.values(files).flatMap((m) => m.default);

const instant: Timing = { duration: () => 0 };

function blank(service: ServiceDetail, decisions?: Record<number, 'yes' | 'no'>): Omit<RequestState, 'visits' | 'current' | 'status' | 'investorMs'> {
  return { id: 'r1', ref: 'MQ-TEST-1', serviceId: service.id, threadId: 't1', createdAt: 0, updatedAt: 0, form: {}, docIds: [], ...(decisions ? { decisions } : {}) };
}

/** Runs a request until it finishes, acting for the investor whenever asked. */
function runToEnd(service: ServiceDetail, decisions?: Record<number, 'yes' | 'no'>): { req: RequestState; investorSteps: number[] } {
  const wf = service.workflow;
  let req = begin(blank(service, decisions), wf, 0);
  const investorSteps: number[] = [];
  let now = 0;
  for (let i = 0; i < 400 && req.current !== null; i++) {
    now += 10;
    req = advance(req, wf, now, instant).req;
    if (req.status === 'needs_you' && req.current !== null) {
      investorSteps.push(req.current);
      now += 10;
      req = act(req, wf, now, instant).req;
    }
  }
  return { req, investorSteps };
}

describe('the catalogue', () => {
  it('has all 50 services across the 7 domains', () => {
    expect(all).toHaveLength(50);
    expect(new Set(all.map((s) => s.domain))).toEqual(new Set(DOMAIN_CODES));
  });
});

describe.each(all.map((s) => [s.id, s] as const))('workflow of %s', (_id, service) => {
  const wf = service.workflow;

  it('has a usual path from the first step to an end', () => {
    const path = mainPath(wf);
    expect(path[0]).toBe(wf.steps[0]?.id);
    const last = findStep(wf, path[path.length - 1] as number) as WorkflowStep;
    expect(last.kind).toBe('end');
  });

  it('can reach every step', () => {
    const seen = reachable(wf);
    for (const step of wf.steps) expect(seen.has(step.id), `step ${step.id} is unreachable`).toBe(true);
  });

  it('runs to completion on the usual path', () => {
    const { req } = runToEnd(service);
    expect(req.current).toBeNull();
    expect(req.status).toBe('done');
    expect(progress(wf, req)).toBe(1);
  });

  it('finishes whichever way each gate goes', () => {
    for (const gate of wf.steps.filter((s) => s.kind === 'gate')) {
      const { req } = runToEnd(service, { [gate.id]: 'no' });
      expect(req.current, `gate ${gate.id} = no never finishes`).toBeNull();
      expect(['done', 'stopped']).toContain(req.status);
    }
  });

  it('has an action for every step that waits for the investor', () => {
    for (const step of wf.steps.filter(waitsForInvestor)) {
      expect(service.actions.some((a) => a.step === step.id), `no action for step ${step.id}`).toBe(true);
    }
  });

  it('fits its usual path inside the published standard', () => {
    expect(pathScale(service)).toBeGreaterThan(0);
    expect(pathScale(service)).toBeLessThanOrEqual(1);
  });
});

describe('the engine', () => {
  const service = all.find((s) => s.id === 'A6') as ServiceDetail;
  const wf = service.workflow;

  it('waits for step durations and stops at the investor', () => {
    const timing = timingFor(service);
    let req = begin(blank(service), wf, 1000);
    const first = advance(req, wf, 1000, timing);
    expect(first.req.status).toBe('active');
    // far in the future everything automatic has happened, and the request waits for the investor
    req = advance(first.req, wf, 1000 + 10 * 60_000, timing).req;
    expect(req.status).toBe('needs_you');
    const step = findStep(wf, req.current as number) as WorkflowStep;
    expect(waitsForInvestor(step)).toBe(true);
  });

  it('does not count the investor’s waiting time against the service standard', () => {
    const timing = timingFor(service);
    let req = begin(blank(service), wf, 0);
    req = advance(req, wf, 600_000, timing).req;
    const before = serviceClockMs(req, 600_000);
    const later = serviceClockMs(req, 900_000);
    expect(later).toBe(before);
    req = act(req, wf, 900_000, timing).req;
    expect(req.investorMs).toBeGreaterThan(0);
  });

  it('fast-forwards the open step', () => {
    const timing = timingFor(service);
    const req = advance(begin(blank(service), wf, 0), wf, 0, timing).req;
    const before = req.visits.length;
    const after = fastForward(req, wf, 1, timing).req;
    expect(after.visits.length).toBeGreaterThan(before);
  });

  it('keeps progress between 0 and 1 and never moves backwards on the usual path', () => {
    let req = begin(blank(service), wf, 0);
    let last = 0;
    let now = 0;
    for (let i = 0; i < 200 && req.current !== null; i++) {
      now += 1;
      req = advance(req, wf, now, instant).req;
      if (req.status === 'needs_you') req = act(req, wf, ++now, instant).req;
      const p = progress(wf, req);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
  });
});

describe('demo time', () => {
  const step = (std: string, kind: WorkflowStep['kind'] = 'auto'): WorkflowStep => ({ id: 1, lane: 'eng', kind, label: { ar: '', en: '' }, text: { ar: '', en: '' }, std: { ar: '', en: std }, enablers: [] });

  it('reads step standards', () => {
    expect(stepDays(step('Instant'))).toBe(0);
    expect(stepDays(step('2 working days'))).toBe(2);
    expect(stepDays(step('1 working day'))).toBe(1);
    expect(stepDays(step('Same day'))).toBe(0.5);
    expect(stepDays(step('Within the hour'))).toBeLessThan(0.5);
    expect(stepDays(step('', 'human'))).toBe(1);
    expect(stepDays(step('', 'auto'))).toBe(0);
    expect(stepDays(step('5 working days', 'gate'))).toBe(0);
  });

  it('converts service standards to days', () => {
    expect(standardDays({ ar: '', en: '', value: 5, unit: 'working_day' })).toBe(5);
    expect(standardDays({ ar: '', en: '', value: 4, unit: 'hour' })).toBe(0.5);
    expect(standardDays({ ar: '', en: '', value: null, unit: null })).toBeNull();
    expect(standardDays({ ar: '', en: '', value: null, unit: 'instant' })).toBe(0);
  });

  it('writes the Arabic dual in the genitive after a preposition', () => {
    expect(durationText(2, 'working_day', 'ar')).toBe('يوما عمل');
    expect(durationText(2, 'working_day', 'ar', { afterPreposition: true })).toBe('يومَي عمل');
    expect(durationText(5, 'working_day', 'ar', { afterPreposition: true })).toBe('5 أيام عمل');
    expect(durationText(2, 'hour', 'en', { afterPreposition: true })).toBe('2 hours');
    expect(standardHeadline({ value: 2, unit: 'working_day' }, 'ar', { afterPreposition: true })).toBe('يومَي عمل');
  });
});
