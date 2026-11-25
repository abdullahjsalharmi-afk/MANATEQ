/**
 * The simulation — pure reducers over the demo world. `actions.ts` binds them to the store and the
 * clock; `seed.ts` replays them on calendar time to build each persona's history.
 *
 * A request moves through its real workflow with the engine (`src/domain/workflow.ts`). Every engine
 * event is turned into its consequences here: a notification when the investor is needed and when a
 * request ends, the documents of a finished request, the services that follow by themselves, and the
 * service's own effects (`effects.ts`). Nothing here reads the clock or the store.
 */
import type { ActionAtom, ServiceDetail, ServiceId, StepAction } from '@/data/types';
import { followers, oncePerPlot } from '@/domain/chains';
import { requestDocs } from '@/domain/documents';
import type { Appointment, Doc, FormValue, RequestState, Visit, World } from '@/domain/types';
import { getService, getZone, requestLabelOf } from '@/data/catalog';
import { findPlot, needsTenancy, plotsFor } from '@/domain/plots';
import { act, advance, begin, currentStep, currentVisit, findStep, isTerminal, mainPath, waitsForInvestor, type EngineEvent, type InvestorRoute, type Outcome, type Timing } from '@/domain/workflow';
import { addPass, atomEffects, payInvoiceNoted, recordPayload, toTime, whenFinished, whenStarted, whenStopped, whenWaiting, type EffectContext } from './effects';
import { allocate, docRef, requestRef } from './refs';
import { dateText, dateTimeText, dots, fill, moneyText, text } from './strings';
import { holdOf, type ActPayload, type AppointmentInput, type Env, type PassInput, type SimRequest, type StartOptions } from './types';
import {
  DAY,
  HOUR,
  RENEWAL_WINDOW_MS,
  addDocs,
  docFacts,
  findPlotRecord,
  findRequest,
  isFinished,
  isQueued,
  notify,
  patchInvoice,
  patchLease,
  patchRequest,
  putRequest,
  resolveRequestAsks,
} from './world';

export interface StartInput extends StartOptions {
  serviceId: ServiceId;
  form?: Record<string, FormValue>;
  /** Scripted gate outcomes; gates not listed take the usual branch. */
  decisions?: Record<number, 'yes' | 'no'>;
}

/** A request never takes more passes than this through `run` in one go (a guard against malformed data). */
const MAX_PASSES = 60;

/* ───────────────────────────── steps answered at start ───────────────────────────── */

const isFile = (value: FormValue): boolean => value !== null && typeof value === 'object' && !('id' in value) && !('phone' in value);

/** What a start flow collects before it submits: answers and documents. */
const ENTRY_TASKS: ReadonlySet<ActionAtom> = new Set<ActionAtom>(['form', 'upload', 'acknowledge']);

const entryStepsCache = new WeakMap<ServiceDetail, number[]>();

/** The investor steps on the usual path that only ask for answers and documents. */
function entrySteps(service: ServiceDetail): number[] {
  let steps = entryStepsCache.get(service);
  if (!steps) {
    const usual = new Set(mainPath(service.workflow));
    steps = service.workflow.steps
      .filter((step) => usual.has(step.id) && waitsForInvestor(step))
      .filter((step) => service.actions.find((action) => action.step === step.id)?.flow.every((task) => ENTRY_TASKS.has(task)) === true)
      .map((step) => step.id);
    entryStepsCache.set(service, steps);
  }
  return steps;
}

/**
 * Services whose start flow already covers their entry steps, so the request never asks twice. The
 * land application collects the documents and the preferred plot in one sitting before it is
 * submitted; vendor registration collects its three documents in the form.
 */
const COVERED_BY_START: Partial<Record<ServiceId, (request: RequestState) => boolean>> = {
  A4: (request) => request.plotId !== undefined || typeof request.form.preferredPlot === 'string',
  G1: (request) => Object.values(request.form).filter(isFile).length >= 3,
};

/** True when the investor already answered this step in the start flow, the first time the request reaches it. */
function answeredAtStart(request: RequestState, service: ServiceDetail, step: number): boolean {
  if (!COVERED_BY_START[service.id]?.(request)) return false;
  return entrySteps(service).includes(step) && !request.visits.some((visit) => visit.step === step && visit.doneAt !== undefined);
}

/**
 * True when the investor reaches this step straight from their own correction step that loops back to
 * it ("replace the guarantee" → "upload the guarantee"): the correction already carried the new answer,
 * so it is not asked again.
 */
function answeredByCorrection(request: RequestState, service: ServiceDetail, step: number): boolean {
  const previous = request.visits[request.visits.length - 2];
  const from = previous ? findStep(service.workflow, previous.step) : undefined;
  return from !== undefined && previous?.doneAt !== undefined && waitsForInvestor(from) && from.back === step && previous.outcome !== 'no';
}

/** The investor's step is already answered: in the start flow, or by the correction that led back to it. */
const answeredAlready = (request: RequestState, service: ServiceDetail, step: number): boolean => answeredAtStart(request, service, step) || answeredByCorrection(request, service, step);

/* ───────────────────────────── choices that steer ───────────────────────────── */

/** What one option of a `choose` step changes, beyond being recorded in the request's form. */
interface ChoiceEffect {
  /** Withdraw the request here, or decline the correction loop and carry on ("no"). */
  route?: InvestorRoute;
  /** The decision a later gate takes because of this choice (it is the investor's answer, not a rule). */
  gate?: { step: number; outcome: Outcome };
  /** The tasks of the step that apply with this option; the others are skipped. */
  tasks?: ActionAtom[];
  /** Go on at this step, where the step's own text says this option skips the steps in between. */
  to?: number;
}

/**
 * Options that change the course of a request, as the workflow pages describe them. Options not
 * listed take the usual path and every task of their step.
 */
const CHOICES: Partial<Record<ServiceId, Record<number, Record<string, ChoiceEffect>>>> = {
  // "Uploads the guarantee issued by the bank, or pays the deposit online; a paid deposit is recorded
  // without bank verification": the deposit skips the reading and checking of a guarantee (steps 4 to 8)
  // and goes on to step 9, "Register links guarantee to contract".
  B2: { 3: { guarantee: { tasks: ['choose', 'upload'] }, deposit: { tasks: ['choose', 'pay'], to: 9 } } },
  // "Redraws in line with the options" returns to step 1; the investor may instead withdraw the request.
  B4: { 4: { withdraw: { route: 'withdraw' } } },
  // Accepting the charge closes the inspection loop and goes on to the settlement.
  B7: { 6: { acceptCharge: { route: 'no' } } },
  // Paid, or a plan agreed: the case is no longer "unpaid and no plan". A plan asks for no payment now.
  B10: { 6: { payNow: { gate: { step: 7, outcome: 'no' } }, paymentPlan: { gate: { step: 7, outcome: 'no' }, tasks: ['choose'] } } },
  // An appeal or a request for more time is not "rectified on time": the HSE manager reviews it.
  // Proof of the fix is uploaded; an appeal or a request for more time gives its reasons instead.
  D6: {
    5: {
      rectified: { tasks: ['acknowledge', 'choose', 'upload'] },
      appeal: { gate: { step: 6, outcome: 'no' }, tasks: ['acknowledge', 'choose', 'form'] },
      extension: { gate: { step: 6, outcome: 'no' }, tasks: ['acknowledge', 'choose', 'form'] },
    },
  },
};

/**
 * Ratings that change the course of a request, as the step says: "a low rating reopens the request for the
 * supervisor" (D1 step 11), "a low rating reopens the case for the BSC supervisor" (E1 step 9, E6 step 10).
 * One or two stars send the request back to the step where that side takes it up again, and the workflow
 * then runs as written until the investor is asked to rate again:
 * D1 → step 10, "Supervisor re-dispatches"; E1 → step 5, where the Business Services Center handles the
 * request; E6 → step 6, where the owner investigates.
 */
const LOW_RATING: Partial<Record<ServiceId, { step: number; atMost: number; to: number; title: 'reopened' | 'reopenedRequest' | 'reopenedComplaint'; body: 'reopenedBody' | 'reopenedHandlingBody' }>> = {
  D1: { step: 11, atMost: 2, to: 10, title: 'reopened', body: 'reopenedBody' },
  E1: { step: 9, atMost: 2, to: 5, title: 'reopenedRequest', body: 'reopenedHandlingBody' },
  E6: { step: 10, atMost: 2, to: 6, title: 'reopenedComplaint', body: 'reopenedHandlingBody' },
};

const starsOf = (rating: ActPayload['rating']): number | undefined => (rating === undefined ? undefined : Math.max(1, Math.min(5, Math.round(typeof rating === 'number' ? rating : rating.stars))));

/** The rule a low rating sets off at this step (where the request goes back to, and what it tells the investor), if any. */
function reopenedBy(serviceId: ServiceId, step: number, rating: ActPayload['rating']) {
  const rule = LOW_RATING[serviceId];
  const stars = starsOf(rating);
  return rule && rule.step === step && stars !== undefined && stars <= rule.atMost ? rule : undefined;
}

/**
 * The steps an investor step may go on to besides its usual successor, because an option or a rating
 * says so (B2 step 3 → 9; D1 step 11 → 10, E1 step 9 → 5, E6 step 10 → 6). For checks that a request's walk is one the engine allows.
 */
export function steeredMoves(serviceId: ServiceId, step: number): number[] {
  const moves = Object.values(CHOICES[serviceId]?.[step] ?? {}).flatMap((effect) => (effect.to !== undefined ? [effect.to] : []));
  const low = LOW_RATING[serviceId];
  if (low && low.step === step) moves.push(low.to);
  return moves;
}

const choiceEffect = (serviceId: ServiceId, step: number, choice: string | undefined): ChoiceEffect | undefined => (choice === undefined ? undefined : CHOICES[serviceId]?.[step]?.[choice]);

/**
 * The tasks of a step that apply once the investor has picked `choice` (all of them when nothing was
 * picked). Given the request, a payment it already made earlier in its thread (`prepaidDocId`: the
 * deposit paid with the offer) is left out, so the step asks for no payment.
 */
export function stepTasks(serviceId: ServiceId, action: Pick<StepAction, 'step' | 'flow'>, choice?: string, request?: Pick<RequestState, 'prepaidDocId'>): ActionAtom[] {
  const only = choiceEffect(serviceId, action.step, choice)?.tasks;
  const tasks = only ? action.flow.filter((task) => only.includes(task)) : action.flow;
  return request?.prepaidDocId !== undefined ? tasks.filter((task) => task !== 'pay') : tasks;
}

/* ───────────────────────────── consequences of engine events ───────────────────────────── */

/** The plot a request is about, as printed: the record's number, or the plot picked in an application. */
function plotNumberOf(world: World, request: RequestState): string | undefined {
  return findPlotRecord(world, request.plotId)?.number ?? request.plotId;
}

/** The finished request's documents, its notification, and the services that follow by themselves. */
function finish(world: World, ctx: EffectContext, env: Env, now: number): World {
  let next = whenFinished[ctx.service.id]?.(world, ctx) ?? world;
  const request = findRequest(next, ctx.id);
  if (!request) return next;

  const made: Doc[] = requestDocs(request, ctx.service, docFacts(next, request.plotId), ctx.at, (spec) => {
    const slot = allocate(next, 'd');
    next = slot.world;
    return { id: slot.id, ref: docRef(spec.kind, slot.seq, ctx.at) };
  });
  if (made.length) {
    next = addDocs(next, made);
    next = patchRequest(next, request.id, { docIds: [...request.docIds, ...made.map((doc) => doc.id)] });
  }

  const last = request.visits[request.visits.length - 1];
  const end = last ? findStep(ctx.service.workflow, last.step) : undefined;
  next = notify(next, {
    at: ctx.at,
    kind: 'done',
    title: dots(requestLabelOf(ctx.service), plotNumberOf(next, request)),
    body: end && isTerminal(end) ? end.label : ctx.service.output,
    route: `/requests/${request.id}`,
    subject: { requestId: request.id },
  });

  for (const follower of followers(ctx.service.id)) {
    const already = next.requests.some((other) => other.serviceId === follower && (other.parentId === request.id || (oncePerPlot(follower) && other.plotId === request.plotId && other.status !== 'stopped')));
    if (already) continue;
    const fresh = findRequest(next, request.id) ?? request;
    next = startIn(next, { serviceId: follower, plotId: fresh.plotId, zoneCode: fresh.zoneCode, threadId: fresh.threadId, parentId: fresh.id }, ctx.at, env, now).world;
  }
  return next;
}

function settle(world: World, id: string, events: EngineEvent[], env: Env, now: number): World {
  let next = world;
  for (const event of events) {
    const request = findRequest(next, id);
    const service = request ? env.detail(request.serviceId) : undefined;
    if (!request || !service) break;
    const ctx: EffectContext = { id, service, at: event.at };

    if (event.type === 'needs_you') {
      if (answeredAlready(request, service, event.step)) continue;
      const action = service.actions.find((candidate) => candidate.step === event.step);
      next = whenWaiting(next, { ...ctx, action });
      next = notify(next, {
        at: event.at,
        kind: 'action',
        title: action?.title ?? text.needsYou,
        body: dots(requestLabelOf(service), plotNumberOf(next, request)),
        route: `/requests/${id}`,
        subject: { requestId: id, step: event.step },
      });
    } else if (event.type === 'finished') {
      next = resolveRequestAsks(next, id, event.at);
      next = finish(next, ctx, env, now);
    } else if (event.type === 'stopped') {
      next = resolveRequestAsks(next, id, event.at);
      next = whenStopped[service.id]?.(next, ctx) ?? next;
      const reason = findStep(service.workflow, event.step);
      next = notify(next, {
        at: event.at,
        kind: 'update',
        title: dots(requestLabelOf(service), plotNumberOf(next, request)),
        body: reason?.label ?? service.output,
        route: `/requests/${id}`,
        subject: { requestId: id },
      });
    }
  }
  return next;
}

/* ───────────────────────────── moving one request ───────────────────────────── */

/** The request without its hold. */
function released(request: RequestState): RequestState {
  if (holdOf(request) === undefined) return request;
  const { holdUntil: _dropped, ...rest } = request as SimRequest;
  return rest;
}

/** When the open step of a request will finish by itself, or undefined when it waits for the investor or is finished. */
export function dueAtOf(request: RequestState, service: ServiceDetail, timing: Timing): number | undefined {
  const step = currentStep(service.workflow, request);
  const open = currentVisit(request);
  if (!step || !open || waitsForInvestor(step)) return undefined;
  const hold = holdOf(request);
  if (hold !== undefined) return Math.max(hold, open.enteredAt);
  if (isTerminal(step) || (step.kind === 'start' && step.lane === 'inv')) return open.enteredAt;
  return open.enteredAt + timing.duration(step);
}

/**
 * Moves one request as far as `now` allows: starts it when its workflow has just arrived in memory,
 * completes the steps the start flow already answered, lets every step that is due finish, and applies
 * the consequences. Returns the same world when nothing was due.
 */
function run(world: World, id: string, env: Env, now: number): World {
  let next = world;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const request = findRequest(next, id);
    if (!request || isFinished(request)) return next;
    const service = env.detail(request.serviceId);
    if (!service) return next;
    const wf = service.workflow;
    const base = env.timing(service);

    if (isQueued(request)) {
      next = putRequest(next, begin(request, wf, request.createdAt));
      next = whenStarted[service.id]?.(next, { id, service, at: request.createdAt }) ?? next;
      continue;
    }

    const step = currentStep(wf, request);
    const open = currentVisit(request);
    if (!step || !open) return next;

    if (request.status === 'needs_you') {
      if (!answeredAlready(request, service, step.id)) return next;
      const result = act(request, wf, open.enteredAt, base);
      next = settle(putRequest(next, result.req), id, result.events, env, now);
      continue;
    }

    const due = dueAtOf(request, service, base);
    if (due === undefined) {
      // An investor step the engine has not flagged yet: let it do so.
      if (!waitsForInvestor(step)) return next;
    } else if (now < due) {
      return next;
    }

    // A held step takes exactly until its hold; every later step takes its usual time.
    const hold = holdOf(request);
    let held: number | undefined = hold !== undefined ? Math.max(0, hold - open.enteredAt) : undefined;
    const timing: Timing = {
      duration(candidate) {
        if (held !== undefined && candidate.id === step.id) {
          const once = held;
          held = undefined;
          return once;
        }
        return base.duration(candidate);
      },
    };
    const result = advance(request, wf, now, timing);
    if (!result.events.length && result.req.status === request.status) return next;
    next = settle(putRequest(next, released(result.req)), id, result.events, env, now);
  }
  return next;
}

/* ───────────────────────────── requests ───────────────────────────── */

/** The land application and the services it starts by itself, which name a plot before it is the investor's. */
const APPLICATION: ReadonlySet<ServiceId> = new Set<ServiceId>(['A4', 'A5', 'A6', 'A7']);

/**
 * Which plot and zone a new request is about. A service about a plot takes one of the investor's own
 * plots (a generic form names it in its `plot` field). A land application may also name a plot of a
 * zone's layout ("AW-117"). Anything else is left out, so a request never points at a plot that does
 * not exist.
 */
function placeOf(world: World, input: StartInput, form: Record<string, FormValue>, service: Parameters<typeof needsTenancy>[0] | undefined): { plotId?: string; zoneCode?: string } {
  const application = APPLICATION.has(input.serviceId);
  // A plot that is only reserved (its application still running) is not yet the investor's to use.
  const own = (id: string | undefined) => {
    const plot = findPlotRecord(world, id);
    return plot && (application || plot.status !== 'reserved') ? plot.id : undefined;
  };
  let named = input.plotId ?? (typeof form.plot === 'string' && form.plot !== '' ? form.plot : undefined);
  // A service only for a plot holder, started without naming a plot: when exactly one plot qualifies
  // (the one leased plot awaiting its handover, the only plot held), the request is about that plot.
  if (named === undefined && !application && service && needsTenancy(service)) {
    const fits = plotsFor(world, input.serviceId);
    if (fits.length === 1) named = fits[0]?.id;
  }
  let plotId = own(named);
  const zoneOfPlot = findPlotRecord(world, plotId)?.zoneCode;
  if (plotId === undefined && named !== undefined && application) {
    const zone = input.zoneCode ?? named.split('-')[0] ?? '';
    if (findPlot(zone, named)) plotId = named;
  }
  const asked = input.zoneCode !== undefined && getZone(input.zoneCode) ? input.zoneCode : undefined;
  const zoneCode = zoneOfPlot ?? (plotId !== undefined ? plotId.split('-')[0] : asked);
  return { ...(plotId !== undefined ? { plotId } : {}), ...(zoneCode !== undefined ? { zoneCode } : {}) };
}

/**
 * Decisions a request's own answers take at a gate, where the gate asks what the answers already say.
 * The eligibility check (A2) sends an activity the rules could not settle ("needs review") to the
 * planning review instead of the clear result.
 */
const ANSWERED_GATES: Partial<Record<ServiceId, (form: Record<string, FormValue>) => Record<number, 'yes' | 'no'>>> = {
  // Step 5: «نتيجة واضحة من القواعد؟» / "Clear result from the rules?"
  A2: (form): Record<number, 'yes' | 'no'> => (form.verdict === 'review' ? { 5: 'no' } : {}),
};

/**
 * Creates a request at `at` and moves it up to `now`. When the service's workflow is not in memory
 * yet the request is queued and starts at the next tick.
 */
export function startIn(world: World, input: StartInput, at: number, env: Env, now: number = at): { world: World; id: string } {
  const slot = allocate(world, 'r');
  const form = { ...(input.form ?? {}) };
  const { plotId, zoneCode } = placeOf(world, input, form, env.detail(input.serviceId) ?? getService(input.serviceId));
  const decisions = { ...(ANSWERED_GATES[input.serviceId]?.(form) ?? {}), ...(input.decisions ?? {}) };
  const queued: RequestState = {
    id: slot.id,
    ref: requestRef(slot.seq, at),
    serviceId: input.serviceId,
    threadId: input.threadId ?? slot.id,
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    createdAt: at,
    updatedAt: at,
    form,
    ...(plotId !== undefined ? { plotId } : {}),
    ...(zoneCode !== undefined ? { zoneCode } : {}),
    visits: [],
    current: null,
    status: 'active',
    ...(Object.keys(decisions).length ? { decisions } : {}),
    investorMs: 0,
    docIds: [],
  };
  let booked = withBookedAppointment(putRequest(slot.world, queued), queued, at);
  // A pass issued on the spot belongs to this request from the start.
  if (input.passId !== undefined && booked.passes.some((pass) => pass.id === input.passId && pass.requestId === undefined)) {
    booked = { ...booked, passes: booked.passes.map((pass) => (pass.id === input.passId ? { ...pass, requestId: slot.id } : pass)) };
  }
  return { world: run(booked, slot.id, env, now), id: slot.id };
}

/** The opening hour of an appointment booked with a request for a preferred day. */
const APPOINTMENT_HOUR = 10;
const CHANNELS: ReadonlySet<Appointment['channel']> = new Set<Appointment['channel']>(['in_person', 'video', 'phone']);

/**
 * E1 "raises a request or books an appointment": a request that asks for an appointment on a preferred
 * day books it at 10:00 that day (in person unless the form names another channel), linked to the
 * request, and tells the investor. Done where requests are started, so every way in books it.
 */
function withBookedAppointment(world: World, request: RequestState, at: number): World {
  if (request.serviceId !== 'E1' || request.form.bookAppointment !== true) return world;
  const day = toTime(request.form.preferredDate);
  if (day === undefined) return world;
  const when = new Date(day);
  when.setHours(APPOINTMENT_HOUR, 0, 0, 0);
  const asked = request.form.channel;
  const channel = typeof asked === 'string' && CHANNELS.has(asked as Appointment['channel']) ? (asked as Appointment['channel']) : 'in_person';
  const summary = getService(request.serviceId);
  const topic = summary ? requestLabelOf(summary) : { ar: request.ref, en: request.ref };
  const booked = bookAppointmentIn(world, { at: when.getTime(), topic, channel, requestId: request.id });
  return notify(booked.world, {
    at,
    kind: 'info',
    title: text.appointmentBooked,
    body: dots(topic, dateTimeText(when.getTime())),
    route: '/account/support',
    subject: { requestId: request.id },
  });
}

/**
 * The investor completes the step that was waiting for them: answers are recorded, the step's tasks
 * take effect (only those that apply to the option picked), and the request moves on, the way the
 * option says when it steers the request.
 */
export function actIn(world: World, id: string, payload: ActPayload, now: number, env: Env): World {
  const request = findRequest(world, id);
  if (!request || request.status !== 'needs_you' || request.current === null) return world;
  const service = env.detail(request.serviceId);
  if (!service) return world;
  const stepId = request.current;
  const action = service.actions.find((candidate) => candidate.step === stepId);
  const steer = choiceEffect(service.id, stepId, payload.choice);
  const reopening = reopenedBy(service.id, stepId, payload.rating);

  // The investor answered what the request asked of them.
  let next = resolveRequestAsks(world, id, now);
  next = recordPayload(next, id, stepId, payload);
  if (action) {
    for (const atom of stepTasks(service.id, action, payload.choice, request)) next = atomEffects[atom]?.(next, { id, service, at: now, action, payload }) ?? next;
  }
  const ready = findRequest(next, id);
  if (!ready) return next;
  const gate = steer?.gate;
  let steered: RequestState = gate ? { ...ready, decisions: { ...(ready.decisions ?? {}), [gate.step]: gate.outcome } } : ready;
  if (reopening && ready.rating) steered = { ...steered, reopenedAt: now, reopenedRating: ready.rating };
  const to = steer?.to ?? reopening?.to;
  const result = act(steered, service.workflow, now, env.timing(service), to !== undefined ? { to } : (steer?.route ?? 'yes'));
  next = putRequest(next, result.req);
  if (reopening) {
    next = notify(next, {
      at: now,
      kind: 'update',
      title: text[reopening.title],
      body: dots(fill(text[reopening.body], { stars: starsOf(payload.rating) ?? 1 }), plotNumberOf(next, result.req)),
      route: `/requests/${id}`,
      subject: { requestId: id },
    });
  }
  next = settle(next, id, result.events, env, now);
  return run(next, id, env, now);
}

/** Demo control: the open step finishes right now instead of taking its time. Does nothing while the investor holds the request. */
export function fastForwardIn(world: World, id: string, now: number, env: Env): World {
  const request = findRequest(world, id);
  if (!request || isFinished(request) || isQueued(request) || request.status === 'needs_you') return world;
  const open = currentVisit(request);
  if (!open) return world;
  const due: SimRequest = { ...request, holdUntil: Math.max(open.enteredAt, now) };
  return run(putRequest(world, due), id, env, now);
}

/** The investor withdraws a request that has not finished. */
export function cancelIn(world: World, id: string, now: number, env: Env): World {
  const request = findRequest(world, id);
  if (!request || isFinished(request)) return world;
  const last = request.visits.length - 1;
  const open = currentVisit(request);
  const service = env.detail(request.serviceId);
  const openStep = service ? currentStep(service.workflow, request) : undefined;
  // The open step is stopped at the moment of withdrawal: it did not finish, so it is never shown as
  // done. A decision that was not taken yet is left out.
  const visits: Visit[] =
    open && openStep?.kind === 'gate'
      ? request.visits.slice(0, last)
      : request.visits.map((visit, index) => (index === last && visit.doneAt === undefined ? { ...visit, stoppedAt: Math.max(now, visit.enteredAt) } : visit));
  const waited = request.status === 'needs_you' && open ? Math.max(0, now - open.enteredAt) : 0;
  const closed: RequestState = { ...released(request), visits, current: null, status: 'stopped', updatedAt: now, investorMs: request.investorMs + waited };
  let next = resolveRequestAsks(putRequest(world, closed), id, now);
  // An appointment booked with the request is not kept for a request that was withdrawn.
  if (next.appointments.some((appointment) => appointment.requestId === id && appointment.status === 'booked')) {
    next = { ...next, appointments: next.appointments.map((appointment) => (appointment.requestId === id && appointment.status === 'booked' ? { ...appointment, status: 'cancelled' } : appointment)) };
  }
  return service ? (whenStopped[service.id]?.(next, { id, service, at: now }) ?? next) : next;
}

/** Parks a request at its open step until `until` (the seed uses it to hold the story still). */
export function holdIn(world: World, id: string, until: number): World {
  const request = findRequest(world, id);
  if (!request || isFinished(request)) return world;
  const held: SimRequest = { ...request, holdUntil: until };
  return putRequest(world, held);
}

/** After a pause, open steps start their time again from `now` instead of all finishing at once. */
export function resumeIn(world: World, now: number, env: Env): World {
  let changed = false;
  const requests = world.requests.map((request) => {
    if (isFinished(request) || request.status === 'needs_you' || holdOf(request) !== undefined) return request;
    const service = env.detail(request.serviceId);
    const open = currentVisit(request);
    if (!service || !open || open.enteredAt >= now) return request;
    changed = true;
    return { ...request, visits: request.visits.map((visit) => (visit === open ? { ...visit, enteredAt: now } : visit)) };
  });
  return changed ? { ...world, requests } : world;
}

/* ───────────────────────────── invoices, passes, appointments ───────────────────────────── */

/**
 * The investor pays an invoice: it is settled with its receipt, the reminders to pay it are settled, and
 * a short note (already read: the investor just did it) opens the receipt in the wallet. A payment made
 * inside a request step leaves the same note (`payInvoiceNoted`).
 */
export function payInvoiceIn(world: World, invoiceId: string, now: number): { world: World; docId: string | null } {
  return payInvoiceNoted(world, invoiceId, now);
}

export function issuePassIn(world: World, input: PassInput, now: number): { world: World; id: string } {
  return addPass(world, input, now);
}

export function revokePassIn(world: World, id: string): World {
  if (!world.passes.some((pass) => pass.id === id && pass.status === 'active')) return world;
  return { ...world, passes: world.passes.map((pass) => (pass.id === id ? { ...pass, status: 'revoked' } : pass)) };
}

export function bookAppointmentIn(world: World, input: AppointmentInput): { world: World; id: string } {
  const slot = allocate(world, 'ap');
  const appointment: Appointment = { id: slot.id, at: input.at, topic: input.topic, channel: input.channel, status: 'booked', ...(input.requestId !== undefined ? { requestId: input.requestId } : {}) };
  return { world: { ...slot.world, appointments: [...slot.world.appointments, appointment] }, id: slot.id };
}

export function cancelAppointmentIn(world: World, id: string): World {
  if (!world.appointments.some((appointment) => appointment.id === id && appointment.status === 'booked')) return world;
  return { ...world, appointments: world.appointments.map((appointment) => (appointment.id === id ? { ...appointment, status: 'cancelled' } : appointment)) };
}

/* ───────────────────────────── the calendar ───────────────────────────── */

/**
 * Things that happen because time passes, not because a request moved: invoices fall overdue, passes
 * and appointments end, and a renewal request opens 120 days before a lease ends.
 */
function calendar(world: World, now: number, env: Env): World {
  let next = world;

  for (const invoice of next.invoices) {
    if (invoice.status !== 'due' || now <= invoice.dueAt) continue;
    next = patchInvoice(next, invoice.id, { status: 'overdue' });
    next = notify(next, {
      at: invoice.dueAt,
      kind: 'action',
      title: text.invoiceOverdue,
      body: dots(invoice.title, moneyText(invoice.amount), fill(text.dueOn, { date: dateText(invoice.dueAt) })),
      route: `/account/payments/${invoice.id}`,
      subject: { invoiceId: invoice.id },
    });
  }

  for (const lease of next.leases) {
    if (lease.status === 'ended') continue;
    const opensAt = lease.endsAt - RENEWAL_WINDOW_MS;
    const status = now > lease.endsAt + DAY ? 'ended' : now >= opensAt ? 'expiring' : 'active';
    if (status !== lease.status) next = patchLease(next, lease.id, { status });
    if (status !== 'expiring') continue;
    const opened = next.requests.some((request) => request.serviceId === 'B3' && request.plotId === lease.plotId && request.createdAt >= opensAt);
    if (!opened) next = startIn(next, { serviceId: 'B3', plotId: lease.plotId }, Math.max(opensAt, lease.startsAt), env, now).world;
  }

  if (next.passes.some((pass) => pass.status === 'active' && pass.to < now)) {
    next = { ...next, passes: next.passes.map((pass) => (pass.status === 'active' && pass.to < now ? { ...pass, status: 'expired' } : pass)) };
  }

  if (next.appointments.some((appointment) => appointment.status === 'booked' && appointment.at + HOUR < now)) {
    next = { ...next, appointments: next.appointments.map((appointment) => (appointment.status === 'booked' && appointment.at + HOUR < now ? { ...appointment, status: 'done' } : appointment)) };
  }

  return next;
}

/**
 * One beat of the simulation. Moves every open request whose workflow is in memory, then lets the
 * calendar act. Idempotent, and cheap when nothing is due: it returns the very same world.
 */
export function tickWorld(world: World, now: number, env: Env): World {
  let next = world;
  // Requests that wait for the investor do not move by themselves; finished ones never move again.
  for (const request of world.requests) {
    if (request.status === 'active') next = run(next, request.id, env, now);
  }
  return calendar(next, now, env);
}
