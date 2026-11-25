/**
 * Every service, walked once from its first step to an end, on the demo clock: the investor takes the
 * usual path, and then, one at a time, each "no" of every decision and each option of every choice.
 * Whatever the workflow book changes, a request must always reach an end or an alternative exit, visit
 * only steps that exist, move only the way its workflow allows, and find an action for every step that
 * asks the investor for something.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { FieldDef, ServiceDetail } from '@/data/types';
import { plotsFor } from '@/domain/plots';
import { timingFor } from '@/domain/simulation';
import type { FormValue, RequestState, World } from '@/domain/types';
import { findStep, firstStep, isTerminal, successor, waitsForInvestor } from '@/domain/workflow';
import { seedWorld } from '@/state/seed';
import { actIn, fastForwardIn, startIn, steeredMoves, stepTasks, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';

const NOW = new Date(2026, 10, 19, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const all: ServiceDetail[] = Object.values(import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true })).flatMap((module) => module.default);

beforeAll(async () => {
  await loadAllServiceDetails();
});

/** A plausible answer to any field, the way a screen would send it. */
function answer(field: FieldDef, plotId: string): FormValue {
  switch (field.type) {
    case 'number':
    case 'area':
      return 5000;
    case 'amount':
      return 1000;
    case 'select':
      return field.options?.[0]?.value ?? 'other';
    case 'date':
      return '2026-12-01';
    case 'file':
    case 'photo':
      return { name: `${field.key}.pdf`, size: 1000 };
    case 'plot':
      return plotId;
    case 'zone':
      return 'BA';
    case 'activity':
      return 'ACT-301';
    case 'toggle':
      return true;
    case 'person':
      return { name: 'شخص تجريبي · Demo person', id: '2•••' };
    default:
      return `${field.key} (demo)`;
  }
}

const formOf = (fields: FieldDef[] | undefined, plotId: string): Record<string, FormValue> => Object.fromEntries((fields ?? []).map((field) => [field.key, answer(field, plotId)]));

interface Scenario {
  name: string;
  decisions?: Record<number, 'no'>;
  /** The option picked at a choice step; other choice steps take their first option. */
  choice?: { step: number; value: string };
}

function scenariosOf(service: ServiceDetail): Scenario[] {
  const list: Scenario[] = [{ name: 'the usual path' }];
  for (const step of service.workflow.steps) if (step.kind === 'gate') list.push({ name: `"no" at decision ${step.id}`, decisions: { [step.id]: 'no' } });
  for (const action of service.actions) for (const option of (action.options ?? []).slice(1)) list.push({ name: `"${option.value}" at step ${action.step}`, choice: { step: action.step, value: option.value } });
  return list;
}

/** Plays one request to its end. Returns it, with every step the investor was asked for. */
function walk(service: ServiceDetail, scenario: Scenario): { request: RequestState; asked: number[]; world: World } {
  let world = seedWorld('tenant', NOW);
  const application = service.id === 'A4';
  const plotId = application ? (plotsFor('AW').find((cell) => cell.status === 'available')?.id as string) : 'BA-121';
  let now = NOW + 60_000;
  const started = startIn(
    world,
    { serviceId: service.id, form: formOf(service.fields, plotId), plotId, ...(application ? { zoneCode: 'AW' } : {}), ...(scenario.decisions ? { decisions: scenario.decisions } : {}) },
    now,
    live,
  );
  world = started.world;
  const asked: number[] = [];
  const read = () => world.requests.find((request) => request.id === started.id) as RequestState;

  for (let move = 0; move < 400; move++) {
    const request = read();
    if (request.status === 'done' || request.status === 'stopped') break;
    if (request.status === 'needs_you' && request.current !== null) {
      const action = service.actions.find((candidate) => candidate.step === request.current);
      expect(action, `${service.id}: no action for investor step ${request.current}`).toBeDefined();
      asked.push(request.current);
      const choice = action?.options?.length ? (scenario.choice?.step === action.step ? scenario.choice.value : action.options[0]?.value) : undefined;
      const tasks = action ? stepTasks(service.id, action, choice) : [];
      world = actIn(
        world,
        request.id,
        {
          ...(choice !== undefined ? { choice } : {}),
          ...(action?.fields ? { form: formOf(action.fields, plotId) } : {}),
          ...(tasks.includes('reference') ? { form: { ...formOf(action?.fields, plotId), reference: 'REF-DEMO-1' } } : {}),
          ...(tasks.includes('upload') ? { files: [{ name: 'evidence.pdf', size: 1000 }] } : {}),
          ...(tasks.includes('rate') ? { rating: 5 } : {}),
        },
        now,
        live,
      );
    } else {
      world = fastForwardIn(world, request.id, now, live);
    }
    now += 2000;
    world = tickWorld(world, now, live);
  }
  return { request: read(), asked, world };
}

describe('every service, walked to its end', () => {
  for (const service of all) {
    describe(`${service.id} · ${service.label.en}`, () => {
      for (const scenario of scenariosOf(service)) {
        it(scenario.name, () => {
          const detail = peekServiceDetail(service.id) as ServiceDetail;
          const wf = detail.workflow;
          const { request, asked } = walk(detail, scenario);

          expect(['done', 'stopped'], `${service.id} did not finish: ${request.status} at step ${request.current}`).toContain(request.status);
          expect(request.visits[0]?.step).toBe(firstStep(wf).id);
          request.visits.forEach((visit, index) => {
            const step = findStep(wf, visit.step);
            expect(step, `${service.id}: step ${visit.step} does not exist`).toBeDefined();
            const next = request.visits[index + 1];
            // The usual successor, or where the step's own text sends an option or a rating (B2 deposit → 9).
            if (step && next) expect([successor(wf, step, visit.outcome ?? 'yes'), ...(waitsForInvestor(step) ? steeredMoves(service.id, step.id) : [])], `${service.id}: ${visit.step} → ${next.step}`).toContain(next.step);
          });
          const last = findStep(wf, request.visits[request.visits.length - 1]?.step ?? -1);
          if (request.status === 'done') expect(last?.kind, `${service.id} is done away from an end`).toBe('end');
          // Stopped at an alternative exit, or withdrawn by the investor where the step offers it.
          else if (last && !isTerminal(last)) expect(waitsForInvestor(last) && scenario.choice !== undefined, `${service.id} stopped at step ${last.id}`).toBe(true);
          else expect(last?.kind).toBe('stop');

          // A step the investor already answered (in the start flow, or with the correction that led back to it) is not asked again.
          if (scenario.decisions === undefined) expect(new Set(asked).size, `${service.id} asked twice: ${asked.join(', ')}`).toBe(asked.length);
          // A scripted "no" really took the other branch.
          for (const gate of Object.keys(scenario.decisions ?? {})) {
            const visit = request.visits.find((candidate) => candidate.step === Number(gate));
            if (visit) expect(visit.outcome, `${service.id}: decision ${gate}`).toBe('no');
          }
        });
      }
    });
  }
});

describe('choices that steer a request', () => {
  const run = (id: string, step: number, value: string) => {
    const service = peekServiceDetail(id) as ServiceDetail;
    return walk(service, { name: value, choice: { step, value } });
  };

  it('B4: withdrawing at the redraw step closes the request there', () => {
    const { request } = run('B4', 4, 'withdraw');
    // The usual path never reaches step 4; script the failed feasibility check.
    const service = peekServiceDetail('B4') as ServiceDetail;
    const failed = walk(service, { name: 'withdraw', decisions: { 3: 'no' }, choice: { step: 4, value: 'withdraw' } }).request;
    expect(request.status).toBe('done');
    expect(failed.status).toBe('stopped');
    expect(failed.visits[failed.visits.length - 1]?.step).toBe(4);
  });

  it('B4: redrawing goes back to the first step and is checked again', () => {
    const service = peekServiceDetail('B4') as ServiceDetail;
    const { request } = walk(service, { name: 'redraw', decisions: { 3: 'no' } });
    expect(request.status).toBe('done');
    expect(request.visits.map((visit) => visit.step).slice(0, 6)).toEqual([1, 2, 3, 4, 1, 2]);
  });

  it('B7: accepting the charge goes on to the settlement instead of a new inspection', () => {
    const service = peekServiceDetail('B7') as ServiceDetail;
    const { request } = walk(service, { name: 'accept', decisions: { 5: 'no' }, choice: { step: 6, value: 'acceptCharge' } });
    const steps = request.visits.map((visit) => visit.step);
    expect(steps.slice(steps.indexOf(6), steps.indexOf(6) + 2)).toEqual([6, 7]);
    expect(steps.filter((step) => step === 4)).toHaveLength(1);
  });

  it('B10: paying or agreeing a plan closes the case without a restriction', () => {
    for (const value of ['payNow', 'paymentPlan']) {
      const { request } = run('B10', 6, value);
      expect(request.status).toBe('stopped');
      expect(request.visits.map((visit) => visit.step)).not.toContain(9);
      expect(request.visits.find((visit) => visit.step === 7)?.outcome).toBe('no');
    }
  });

  it('B10: paying now settles the overdue invoices of the lease', () => {
    const { world, request } = run('B10', 6, 'payNow');
    expect(world.invoices.filter((invoice) => invoice.leaseId !== undefined && invoice.status !== 'paid')).toEqual([]);
    expect(request.amount).toBe(37_500);
  });

  it('D6: an appeal goes to the HSE manager; a fix goes straight on', () => {
    expect(run('D6', 5, 'appeal').request.visits.map((visit) => visit.step)).toContain(7);
    const fixed = walk(peekServiceDetail('D6') as ServiceDetail, { name: 'fixed' }).request;
    expect(fixed.visits.map((visit) => visit.step)).not.toContain(7);
  });

  it('B2: a guarantee is uploaded, a deposit is paid; a deposit paid with the offer is not asked for again', () => {
    const service = peekServiceDetail('B2') as ServiceDetail;
    const action = service.actions.find((candidate) => candidate.step === 3);
    expect(action && stepTasks('B2', action, 'guarantee')).toEqual(['choose', 'upload']);
    expect(action && stepTasks('B2', action, 'deposit')).toEqual(['choose', 'pay']);
    const paid = run('B2', 3, 'deposit');
    expect(paid.world.invoices.some((invoice) => invoice.requestId === paid.request.id && invoice.status === 'paid')).toBe(true);
    // In the tenant's thread of AW-116 the offer (A6) took the deposit: choosing the deposit asks for no payment again.
    let tenant = seedWorld('tenant', NOW);
    const earlier = tenant.requests.find((request) => request.serviceId === 'B2') as RequestState;
    const again = startIn(tenant, { serviceId: 'B2', plotId: 'AW-116', threadId: earlier.threadId }, NOW + 1000, live);
    tenant = tickWorld(again.world, NOW + 60_000, live);
    const waiting = tenant.requests.find((request) => request.id === again.id) as RequestState;
    expect(waiting).toMatchObject({ status: 'needs_you', current: 3 });
    expect(waiting.amount).toBeUndefined();
    // The step says which receipt already covers it, and asks for no payment with the deposit.
    const offerReceipt = tenant.docs.find((doc) => doc.id === waiting.prepaidDocId);
    expect(offerReceipt).toMatchObject({ kind: 'receipt', serviceId: 'A6' });
    expect(action && stepTasks('B2', action, 'deposit', waiting)).toEqual(['choose']);
    expect(action && stepTasks('B2', action, 'guarantee', waiting)).toEqual(['choose', 'upload']);
    const before = tenant.invoices.length;
    tenant = actIn(tenant, again.id, { choice: 'deposit' }, NOW + 70_000, live);
    expect(tenant.invoices).toHaveLength(before);
    expect(tenant.requests.find((request) => request.id === again.id)?.status).toBe('active');
  });

  it('A2: an activity the rules cannot settle goes to the planning review; a clear one does not', () => {
    const world = seedWorld('guest', NOW);
    const form = { activity: 'ACT-301', solution: 'logistics', area: 5000, zone: 'BA' };
    const review = startIn(world, { serviceId: 'A2', form: { ...form, verdict: 'review' } }, NOW, live);
    const reviewed = tickWorld(review.world, NOW + 10 * 60_000, live).requests.find((request) => request.id === review.id) as RequestState;
    expect(reviewed.visits.map((visit) => visit.step)).toContain(6);
    const clear = startIn(world, { serviceId: 'A2', form: { ...form, verdict: 'targeted' } }, NOW, live);
    const cleared = tickWorld(clear.world, NOW + 10 * 60_000, live).requests.find((request) => request.id === clear.id) as RequestState;
    expect(cleared.visits.map((visit) => visit.step)).not.toContain(6);
  });

  it('C6, B2, E5, G1: a correction that loops back to an upload step is not asked twice', () => {
    for (const [id, gate] of [['C6', 5], ['B2', 5], ['E5', 6], ['G1', 6]] as const) {
      const { request, asked } = walk(peekServiceDetail(id) as ServiceDetail, { name: 'fix', decisions: { [gate]: 'no' } });
      expect(request.status, id).toBe('done');
      expect(new Set(asked).size, `${id} asked ${asked.join(', ')}`).toBe(asked.length);
    }
  });
});
