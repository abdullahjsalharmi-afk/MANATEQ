/**
 * Workflow engine — pure functions over the workflow of a service (the steps published in the
 * Automation & Integration Manual) and the state of one request.
 *
 * A workflow is a small graph: steps run in order unless a step says otherwise (`next`), gates branch
 * (`yes` / `no`), a correction step may loop back (`back`), and `end` / `stop` steps finish the request.
 * An investor step that loops back takes the loop by default ("yes"); when the investor declines the
 * correction ("no", e.g. accepting a charge instead of reinstating) the request carries on forward.
 * Steps in the investor lane of kind `human` wait for the investor; every other step completes on its
 * own after its duration (see simulation.ts for how long that is in demo time).
 */
import type { Lane, Workflow, WorkflowStep } from '@/data/types';
import type { RequestState, Visit } from './types';

export type Outcome = 'yes' | 'no';

export interface EngineEvent {
  type: 'step_done' | 'needs_you' | 'finished' | 'stopped';
  step: number;
  at: number;
  outcome?: Outcome;
}

export interface Timing {
  /** How long a non-investor step takes, in ms of demo time. */
  duration(step: WorkflowStep): number;
}

/** Guards against malformed data: no request ever walks more steps than this in one go. */
const MAX_HOPS = 200;

export function findStep(wf: Workflow, id: number): WorkflowStep | undefined {
  return wf.steps.find((s) => s.id === id);
}

export function firstStep(wf: Workflow): WorkflowStep {
  const first = wf.steps[0];
  if (!first) throw new Error('workflow has no steps');
  return first;
}

export function isTerminal(step: WorkflowStep): boolean {
  return step.kind === 'end' || step.kind === 'stop';
}

/** True when the request cannot move until the investor does something. */
export function waitsForInvestor(step: WorkflowStep): boolean {
  return step.lane === 'inv' && step.kind === 'human';
}

/** The id of the step that follows `step`, or null when the workflow ends there. */
export function successor(wf: Workflow, step: WorkflowStep, outcome: Outcome = 'yes'): number | null {
  if (isTerminal(step)) return null;
  if (step.kind === 'gate') {
    const branch = outcome === 'no' ? step.no : step.yes;
    if (branch !== undefined) return branch;
  }
  if (step.back !== undefined && outcome === 'yes') return step.back;
  if (step.next !== undefined) return step.next;
  const index = wf.steps.indexOf(step);
  const following = wf.steps[index + 1];
  return following ? following.id : null;
}

/**
 * The usual path through the workflow: from the first step, taking the "yes" branch at every gate,
 * until an end. This is what the investor is shown as "what happens next".
 */
export function mainPath(wf: Workflow): number[] {
  const path: number[] = [];
  const seen = new Set<number>();
  let step: WorkflowStep | undefined = firstStep(wf);
  while (step && !seen.has(step.id) && path.length < MAX_HOPS) {
    path.push(step.id);
    seen.add(step.id);
    const nextId = successor(wf, step, 'yes');
    step = nextId === null ? undefined : findStep(wf, nextId);
  }
  return path;
}

/** Every step that can be reached from the first one, following all branches. */
export function reachable(wf: Workflow): Set<number> {
  const seen = new Set<number>();
  const queue: number[] = [firstStep(wf).id];
  while (queue.length) {
    const id = queue.pop() as number;
    if (seen.has(id)) continue;
    seen.add(id);
    const step = findStep(wf, id);
    if (!step) continue;
    for (const outcome of ['yes', 'no'] as const) {
      const nextId = successor(wf, step, outcome);
      if (nextId !== null) queue.push(nextId);
    }
  }
  return seen;
}

export function currentStep(wf: Workflow, req: RequestState): WorkflowStep | undefined {
  return req.current === null ? undefined : findStep(wf, req.current);
}

export function currentVisit(req: RequestState): Visit | undefined {
  const last = req.visits[req.visits.length - 1];
  // A visit stopped by a withdrawal did not finish, but it is not open either.
  return last && last.doneAt === undefined && last.stoppedAt === undefined ? last : undefined;
}

/** Which lane holds the request right now, or null when it is finished. */
export function holderLane(wf: Workflow, req: RequestState): Lane | null {
  return currentStep(wf, req)?.lane ?? null;
}

/**
 * Progress along the usual path, 0–1. A request on a detour (a correction loop, an exception branch)
 * keeps the progress of the last usual-path step it passed.
 */
export function progress(wf: Workflow, req: RequestState): number {
  if (req.status === 'done') return 1;
  const path = mainPath(wf);
  if (path.length < 2) return 0;
  let best = 0;
  let stopped = -1;
  for (const visit of req.visits) {
    const index = path.indexOf(visit.step);
    // A step stopped by a withdrawal was reached, not done.
    if (visit.stoppedAt !== undefined && visit.doneAt === undefined) stopped = Math.max(stopped, index);
    else if (index > best) best = index;
  }
  // The open step counts as "reached", not "done".
  const reached = stopped > best ? stopped - 0.5 : req.current !== null && path.indexOf(req.current) === best ? best - 0.5 : best;
  return Math.max(0, Math.min(1, reached / (path.length - 1)));
}

function enter(req: RequestState, stepId: number, at: number): void {
  req.visits.push({ step: stepId, enteredAt: at });
  req.current = stepId;
}

function gateOutcome(req: RequestState, step: WorkflowStep): Outcome {
  if (step.kind !== 'gate') return 'yes';
  // A scripted "no" is consumed once, so a correction loop does not repeat forever.
  const scripted = req.decisions?.[step.id];
  if (scripted === 'no') {
    const visitsOfGate = req.visits.filter((v) => v.step === step.id && v.doneAt !== undefined).length;
    return visitsOfGate === 0 ? 'no' : 'yes';
  }
  return 'yes';
}

/** Starts a request at the first step of its workflow. Call `advance` afterwards. */
export function begin(req: Omit<RequestState, 'visits' | 'current' | 'status' | 'investorMs'>, wf: Workflow, now: number): RequestState {
  const started: RequestState = { ...req, visits: [], current: null, status: 'active', investorMs: 0, updatedAt: now };
  enter(started, firstStep(wf).id, now);
  return started;
}

/**
 * Moves a request forward as far as time allows. Returns a new request object and the events that
 * happened (in order). Stops at an investor step, at a step that is not due yet, or at the end.
 */
export function advance(input: RequestState, wf: Workflow, now: number, timing: Timing): { req: RequestState; events: EngineEvent[] } {
  const req: RequestState = { ...input, visits: input.visits.map((v) => ({ ...v })) };
  const events: EngineEvent[] = [];

  for (let hops = 0; hops < MAX_HOPS; hops++) {
    const step = currentStep(wf, req);
    const visit = currentVisit(req);
    if (!step || !visit) break;

    if (isTerminal(step)) {
      visit.doneAt = visit.enteredAt;
      req.current = null;
      req.status = step.kind === 'end' ? 'done' : 'stopped';
      req.updatedAt = visit.enteredAt;
      events.push({ type: step.kind === 'end' ? 'finished' : 'stopped', step: step.id, at: visit.enteredAt });
      break;
    }

    if (waitsForInvestor(step)) {
      if (req.status !== 'needs_you') {
        req.status = 'needs_you';
        req.updatedAt = visit.enteredAt;
        events.push({ type: 'needs_you', step: step.id, at: visit.enteredAt });
      }
      break;
    }

    // The investor's own start step is done the moment the request exists.
    const duration = step.kind === 'start' && step.lane === 'inv' ? 0 : timing.duration(step);
    const dueAt = visit.enteredAt + duration;
    if (now < dueAt) {
      req.status = 'active';
      break;
    }

    const outcome = gateOutcome(req, step);
    visit.doneAt = dueAt;
    if (step.kind === 'gate') visit.outcome = outcome;
    req.updatedAt = dueAt;
    req.status = 'active';
    events.push({ type: 'step_done', step: step.id, at: dueAt, ...(step.kind === 'gate' ? { outcome } : {}) });

    const nextId = successor(wf, step, outcome);
    if (nextId === null || !findStep(wf, nextId)) {
      req.current = null;
      req.status = 'done';
      events.push({ type: 'finished', step: step.id, at: dueAt });
      break;
    }
    enter(req, nextId, dueAt);
  }

  return { req, events };
}

/**
 * How the investor completes a step: the usual way ("yes"), declining a correction loop so the request
 * carries on forward ("no", only meaningful on a step that loops back), withdrawing the request there,
 * or going on at a given step where the step's own text says so (`{ to }`: B2 "a paid deposit is
 * recorded without bank verification" goes on to the register; D1 "a low rating reopens the request
 * for the supervisor" goes back to the supervisor).
 */
export type InvestorRoute = Outcome | 'withdraw' | { to: number };

/** The investor completes the step that was waiting for them. */
export function act(input: RequestState, wf: Workflow, now: number, timing: Timing, route: InvestorRoute = 'yes'): { req: RequestState; events: EngineEvent[] } {
  const step = currentStep(wf, input);
  const open = currentVisit(input);
  if (!step || !open || !waitsForInvestor(step)) return { req: input, events: [] };

  const req: RequestState = { ...input, visits: input.visits.map((v) => ({ ...v })) };
  const visit = req.visits[req.visits.length - 1] as Visit;
  visit.doneAt = now;
  req.investorMs += Math.max(0, now - visit.enteredAt);
  req.updatedAt = now;
  req.status = 'active';
  const events: EngineEvent[] = [{ type: 'step_done', step: step.id, at: now }];

  if (route === 'withdraw') {
    req.current = null;
    req.status = 'stopped';
    events.push({ type: 'stopped', step: step.id, at: now });
    return { req, events };
  }
  const outcome: Outcome = route === 'no' && step.back !== undefined ? 'no' : 'yes';
  if (outcome === 'no') visit.outcome = 'no';

  const nextId = typeof route === 'object' ? route.to : successor(wf, step, outcome);
  if (nextId === null || !findStep(wf, nextId)) {
    req.current = null;
    req.status = 'done';
    events.push({ type: 'finished', step: step.id, at: now });
    return { req, events };
  }
  enter(req, nextId, now);
  const rest = advance(req, wf, now, timing);
  return { req: rest.req, events: events.concat(rest.events) };
}

/**
 * Demo control: finish the step that is currently open (when it is not the investor's) right now,
 * instead of waiting for its duration.
 */
export function fastForward(input: RequestState, wf: Workflow, now: number, timing: Timing): { req: RequestState; events: EngineEvent[] } {
  const step = currentStep(wf, input);
  const open = currentVisit(input);
  if (!step || !open || waitsForInvestor(step)) return { req: input, events: [] };
  const req: RequestState = { ...input, visits: input.visits.map((v) => ({ ...v })) };
  const visit = req.visits[req.visits.length - 1] as Visit;
  // Pretend the step was entered long enough ago to be due exactly now.
  visit.enteredAt = Math.min(visit.enteredAt, now - timing.duration(step));
  return advance(req, wf, now, timing);
}

/** Time (ms) the request has spent with anyone but the investor — what the service standard measures. */
export function serviceClockMs(req: RequestState, now: number): number {
  const first = req.visits[0];
  if (!first) return 0;
  const last = req.visits[req.visits.length - 1] as Visit;
  const end = req.current === null ? (last.doneAt ?? last.stoppedAt ?? last.enteredAt) : now;
  let investorOpen = 0;
  if (req.status === 'needs_you' && last.doneAt === undefined) investorOpen = Math.max(0, now - last.enteredAt);
  return Math.max(0, end - first.enteredAt - req.investorMs - investorOpen);
}
