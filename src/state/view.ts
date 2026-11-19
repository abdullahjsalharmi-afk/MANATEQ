/**
 * The view of one request — everything a screen needs to answer "where is it, who has it, how long
 * has it taken, what do I do?" — derived from the request and the workflow of its service. Pure.
 */
import type { LangValue } from '@/app/i18n';
import { getIntegration, reference } from '@/data/catalog';
import type { L10n, Lane, ServiceDetail, StepAction, StepKind, WorkflowStep } from '@/data/types';
import { pathScale, standardDays, stepDays, timingFor, type StandardClock } from '@/domain/simulation';
import type { Holder, RequestState, RequestStatus } from '@/domain/types';
import { currentStep, currentVisit, findStep, firstStep, isTerminal, progress, successor, waitsForInvestor } from '@/domain/workflow';
import { dueAtOf } from './sim';
import { text } from './strings';
import { holdOf } from './types';

export type TimelineState = 'done' | 'current' | 'upcoming';

/** One row of a request's timeline: a step that happened, the step that is open, or a step to come. */
export interface TimelineEntry {
  /** Stable across re-renders; a step visited twice has two entries. */
  id: string;
  step: number;
  kind: StepKind;
  title: L10n;
  text: L10n;
  lane: Lane;
  /** Who holds the step, in words: you, Manateq's staff, the field team, or the national entity by name. */
  holderName: L10n;
  state: TimelineState;
  /** Done steps: when the step finished. The open step: when it is expected to finish, if a date is known. */
  time?: number;
  /** The step runs without a person. */
  auto: boolean;
  /** For decisions that were taken: which way. */
  outcome?: 'yes' | 'no';
  /** The step's own published standard ("Instant", "2 working days"); may be empty. */
  standard: L10n;
}

export interface RequestView {
  status: RequestStatus;
  /** Who has the request now, or null when it is finished. */
  holder: Holder | null;
  currentStep: WorkflowStep | null;
  /** What the investor is asked to do, when the request waits for them. */
  pendingAction: StepAction | null;
  /** Working days of the service standard used so far. */
  clock: StandardClock;
  /** 0–1 along the usual path. */
  progress: number;
  timeline: TimelineEntry[];
  /** Since when the current holder has had it. */
  heldSince?: number;
  /** When the open step will finish by itself (never set while the investor holds the request). */
  expectedAt?: number;
  /** When the request ended. */
  finishedAt?: number;
}

/** Who holds a step, in words. A national step is named after the first platform or entity it uses. */
export function holderNameOf(step: Pick<WorkflowStep, 'lane' | 'enablers'>): L10n {
  if (step.lane === 'inv') return text.you;
  if (step.lane === 'nat') {
    const integration = step.enablers.find((id) => id.startsWith('I'));
    const named = integration ? getIntegration(integration)?.short : undefined;
    if (named) return named;
  }
  return reference.lanes[step.lane].short;
}

export function holderOf(step: Pick<WorkflowStep, 'lane' | 'enablers'>): Holder {
  return { lane: step.lane, name: holderNameOf(step) };
}

const countsOnClock = (step: WorkflowStep): boolean => !waitsForInvestor(step) && !isTerminal(step) && step.kind !== 'gate' && !(step.kind === 'start' && step.lane === 'inv');

/**
 * The service-standard clock of a request, in working days of the story: the published time of every
 * step that is behind it, plus the share of the open step that has passed. Time spent waiting for the
 * investor never counts, and instant steps count as nothing however long they take to watch.
 */
export function standardClockOf(request: RequestState, service: Pick<ServiceDetail, 'standard' | 'workflow'>, now: number, speed = 1): StandardClock {
  const scale = pathScale(service);
  let usedDays = 0;
  for (const visit of request.visits) {
    const step = findStep(service.workflow, visit.step);
    if (!step || !countsOnClock(step)) continue;
    const days = stepDays(step) * scale;
    if (visit.doneAt !== undefined) {
      usedDays += days;
      continue;
    }
    const hold = holdOf(request);
    const expected = hold !== undefined ? hold - visit.enteredAt : timingFor(service, speed).duration(step);
    const share = expected > 0 ? Math.max(0, Math.min(1, (now - visit.enteredAt) / expected)) : 1;
    usedDays += days * share;
  }
  const targetDays = standardDays(service.standard);
  const ratio = targetDays === null ? null : targetDays <= 0 ? 1 : usedDays / targetDays;
  return { usedDays, targetDays, ratio, dayNumber: Math.max(1, Math.ceil(usedDays)) };
}

const isAutomatic = (step: WorkflowStep): boolean => step.kind === 'auto' || step.kind === 'gate' || (step.kind === 'start' && step.lane !== 'inv');

function entry(step: WorkflowStep, id: string, state: TimelineState): TimelineEntry {
  return { id, step: step.id, kind: step.kind, title: step.label, text: step.text, lane: step.lane, holderName: holderNameOf(step), state, auto: isAutomatic(step), standard: step.std };
}

/** The steps a request has been through, the one that is open, and the usual way from there to the end. */
function timelineOf(request: RequestState, service: Pick<ServiceDetail, 'workflow'>): TimelineEntry[] {
  const wf = service.workflow;
  const entries: TimelineEntry[] = [];
  request.visits.forEach((visit, index) => {
    const step = findStep(wf, visit.step);
    if (!step) return;
    const open = visit.doneAt === undefined && request.current === visit.step;
    const item = entry(step, `v${index}`, open ? 'current' : 'done');
    if (visit.doneAt !== undefined) item.time = visit.doneAt;
    else if (open && holdOf(request) !== undefined) item.time = holdOf(request);
    if (visit.outcome) item.outcome = visit.outcome;
    entries.push(item);
  });

  // What usually comes next, from the open step (or from the start for a request that has not begun).
  const seen = new Set<number>();
  let cursor: WorkflowStep | undefined;
  if (request.visits.length === 0 && request.status !== 'done' && request.status !== 'stopped') cursor = firstStep(wf);
  else {
    const open = currentStep(wf, request);
    const nextId = open ? successor(wf, open, 'yes') : null;
    cursor = nextId === null ? undefined : findStep(wf, nextId);
    if (open) seen.add(open.id);
  }
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    entries.push(entry(cursor, `s${cursor.id}`, 'upcoming'));
    const nextId = successor(wf, cursor, 'yes');
    cursor = nextId === null ? undefined : findStep(wf, nextId);
  }
  return entries;
}

/**
 * Everything a screen shows about one request. `now` and `speed` only matter to the clock and to the
 * expected time of the open step.
 */
export function requestView(request: RequestState, service: ServiceDetail, now: number, speed = 1): RequestView {
  const wf = service.workflow;
  const step = currentStep(wf, request) ?? null;
  const open = currentVisit(request);
  const expectedAt = dueAtOf(request, service, timingFor(service, speed));
  const last = request.visits[request.visits.length - 1];
  const finished = request.status === 'done' || request.status === 'stopped';
  return {
    status: request.status,
    holder: step ? holderOf(step) : finished ? null : { lane: 'one', name: reference.lanes.one.short },
    currentStep: step,
    pendingAction: request.status === 'needs_you' && step ? (service.actions.find((action) => action.step === step.id) ?? null) : null,
    clock: standardClockOf(request, service, now, speed),
    progress: progress(wf, request),
    timeline: timelineOf(request, service),
    ...(open ? { heldSince: open.enteredAt } : {}),
    ...(expectedAt !== undefined ? { expectedAt } : {}),
    ...(finished && last ? { finishedAt: last.doneAt ?? request.updatedAt } : {}),
  };
}

/** One row of the design system's `Timeline`, in the language on screen. */
export interface TimelineRow {
  id: string;
  title: string;
  text?: string;
  lane: Lane;
  holderName?: string;
  state: TimelineState;
  time?: string;
  auto: boolean;
  outcome?: string;
  standard?: string;
}

const HOUR = 3_600_000;

/**
 * Turns timeline entries into the rows the `Timeline` component takes: text in the language on
 * screen, times formatted (the clock time for the last 20 hours, the date before that).
 */
export function timelineRows(entries: TimelineEntry[], lang: Pick<LangValue, 'pick' | 'fmt'>, now: number): TimelineRow[] {
  return entries.map((item) => {
    const row: TimelineRow = { id: item.id, title: lang.pick(item.title), lane: item.lane, state: item.state, auto: item.auto };
    const body = lang.pick(item.text);
    if (body) row.text = body;
    // The component has its own words for the investor, the app and the engine; an entity is named.
    if (item.lane === 'nat') row.holderName = lang.pick(item.holderName);
    if (item.time !== undefined) row.time = Math.abs(now - item.time) < 20 * HOUR ? lang.fmt.time(item.time) : lang.fmt.dayMonth(item.time);
    if (item.outcome) row.outcome = lang.pick(item.outcome === 'yes' ? text.yes : text.no);
    const standard = lang.pick(item.standard);
    if (standard) row.standard = standard;
    return row;
  });
}
