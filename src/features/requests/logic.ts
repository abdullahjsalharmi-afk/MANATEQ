/**
 * Pure helpers of the requests feature: how the list groups a thread, how far along its chain a
 * request is, which tasks the action runner asks for, which receipts a payment filed and whether a
 * request has a day clock. No React, no store: everything here is unit-tested.
 */
import { chainFrom, unlocks } from '@/domain/chains';
import type { ActionAtom, ServiceId, StepAction } from '@/data/types';
import type { RequestState } from '@/domain/types';

/* ───────────────────────────── the list ───────────────────────────── */

export interface ThreadPlace {
  /** The service that opened the thread (the land application for A4 → A8). */
  rootServiceId: ServiceId;
  /** 1-based stage of the request in its chain. */
  position: number;
  /** Stages the chain usually has, never fewer than the thread already holds. */
  total: number;
}

export interface RequestGroup {
  /** The thread id. */
  key: string;
  /** The latest stage of the thread in this segment: shown on top. */
  top: RequestState;
  /** The other stages of the thread in this segment, latest first. */
  rest: RequestState[];
  /** Where the top request sits in its chain; only for requests that belong to a chain of several. */
  place?: ThreadPlace;
}

/** The services a chain usually runs through: the automatic followers and what they unlock, in order. */
export function expectedChain(rootServiceId: ServiceId): ServiceId[] {
  const chain: ServiceId[] = [];
  const queue: ServiceId[] = [rootServiceId];
  while (queue.length) {
    const id = queue.shift() as ServiceId;
    for (const step of chainFrom(id)) {
      if (chain.includes(step)) continue;
      chain.push(step);
      queue.push(...unlocks(step));
    }
  }
  return chain;
}

/** Where a request stands in its thread (`thread` holds every request of the thread, any order). */
export function placeInThread(request: RequestState, thread: RequestState[]): ThreadPlace | undefined {
  const ordered = [...thread].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const root = ordered[0];
  if (!root) return undefined;
  const expected = expectedChain(root.serviceId);
  const total = Math.max(ordered.length, expected.length);
  if (total < 2) return undefined;
  const index = ordered.findIndex((other) => other.id === request.id);
  if (index < 0) return undefined;
  return { rootServiceId: root.serviceId, position: index + 1, total };
}

const latestFirst = (a: RequestState, b: RequestState): number => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt;

/**
 * Groups the requests of one segment by thread. `all` is every request of the investor, so that a
 * thread's place in its chain counts the stages that sit in the other segment too. Groups whose top
 * request waits for the investor come first, then the most recently moved.
 */
export function groupRequests(segment: RequestState[], all: RequestState[]): RequestGroup[] {
  const byThread = new Map<string, RequestState[]>();
  for (const request of segment) {
    const list = byThread.get(request.threadId);
    if (list) list.push(request);
    else byThread.set(request.threadId, [request]);
  }
  const groups: RequestGroup[] = [];
  for (const [key, members] of byThread) {
    const sorted = [...members].sort(latestFirst);
    // A stage that waits for the investor goes on top even when a later one exists.
    const waiting = sorted.find((request) => request.status === 'needs_you');
    const top = waiting ?? (sorted[0] as RequestState);
    const rest = sorted.filter((request) => request !== top);
    const thread = all.filter((request) => request.threadId === key);
    const place = thread.length > 1 ? placeInThread(top, thread) : undefined;
    groups.push(place ? { key, top, rest, place } : { key, top, rest });
  }
  return groups.sort(
    (a, b) =>
      Number(b.top.status === 'needs_you') - Number(a.top.status === 'needs_you') ||
      Math.max(b.top.updatedAt, ...b.rest.map((r) => r.updatedAt)) - Math.max(a.top.updatedAt, ...a.rest.map((r) => r.updatedAt)),
  );
}

/* ───────────────────────────── the action runner ───────────────────────────── */

/** Atoms the runner shows on its own, in the general sheet. `pay` and `sign` have their own sheets. */
export type SheetAtom = Exclude<ActionAtom, 'pay' | 'sign'>;

/**
 * The tasks of a step in the order the runner asks for them. When the step offers options the choice
 * comes first, and after it only the tasks that choice needs (`tasksFor`, from the state layer's
 * `stepTasks`) follow; before the choice is made the list ends at the choice.
 */
export function runnerTasks(action: Pick<StepAction, 'flow' | 'options'>, choice: string | undefined, tasksFor: (choice: string | undefined) => ActionAtom[]): ActionAtom[] {
  const hasChoice = Boolean(action.options?.length) || action.flow.includes('choose');
  if (!hasChoice) return dedupe(action.flow);
  if (choice === undefined) return ['choose'];
  return dedupe(['choose', ...tasksFor(choice).filter((task) => task !== 'choose')]);
}

function dedupe(list: ActionAtom[]): ActionAtom[] {
  return list.filter((task, index) => list.indexOf(task) === index);
}

/** The receipt document of a payment, as the runner needs it to name the receipt. */
export interface ReceiptLike {
  id: string;
  ref: string;
  kind: string;
}

/**
 * The receipts a payment filed against a request: the receipt documents it holds now that it did not
 * hold before (`before` is the request's `docIds` just before the step was completed).
 */
export function newReceipts<D extends ReceiptLike>(before: readonly string[], after: readonly string[], docs: readonly D[]): D[] {
  const added = after.filter((id) => !before.includes(id));
  return added.map((id) => docs.find((doc) => doc.id === id)).filter((doc): doc is D => doc !== undefined && doc.kind === 'receipt');
}

/**
 * The deposit of a new contract (B2) was already taken with the offer (A6) of the same thread: the state
 * then fixes no amount for the step and files no second payment. Returns the receipt of that deposit
 * when it can be found (`thread` is every request of the thread, `docs` every document).
 */
export function depositPaidWithOffer<D extends ReceiptLike & { requestId?: string }>(
  request: Pick<RequestState, 'id' | 'amount'>,
  action: Pick<StepAction, 'amount'>,
  thread: readonly Pick<RequestState, 'id' | 'serviceId' | 'docIds'>[],
  docs: readonly D[],
): { receipt: D | undefined } | null {
  if (action.amount?.basis !== 'deposit' || request.amount !== undefined) return null;
  const offer = thread.find((other) => other.id !== request.id && other.serviceId === 'A6');
  if (!offer) return null;
  const receipt = docs.find((doc) => doc.kind === 'receipt' && offer.docIds.includes(doc.id));
  return receipt ? { receipt } : null;
}

/**
 * Services whose published standard is a promise about each status update or a monitoring cycle (the
 * building permit: "status updated within one working day of each Ministry event"), not a duration for
 * the whole request. Their requests show no day clock: the holder and the expected time say when.
 */
const PER_EVENT_STANDARDS: ReadonlySet<ServiceId> = new Set<ServiceId>(['C2', 'C3', 'E7', 'G3', 'G4']);

/** Whether the request's clock is a real "day n of m" countdown worth a ring and a figure. */
export function hasDayClock(serviceId: ServiceId, clock: { ratio: number | null; targetDays: number | null } | undefined): boolean {
  if (!clock || clock.ratio === null || clock.targetDays === null || clock.targetDays <= 0) return false;
  return !PER_EVENT_STANDARDS.has(serviceId);
}

/**
 * The gate pass a pass request (D2) issued, found by the holder and plot it was asked for. Passes do
 * not record their request, so this matches what the request asked for; undefined when nothing matches.
 */
export function passOfRequest<P extends { holder: string; plotId: string; status: string }>(request: Pick<RequestState, 'serviceId' | 'plotId' | 'form' | 'status'>, passes: readonly P[]): P | undefined {
  if (request.serviceId !== 'D2' || request.status !== 'done') return undefined;
  const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  const visitor = request.form.visitor;
  const visitorName = visitor !== null && typeof visitor === 'object' && 'name' in visitor ? text(visitor.name) : undefined;
  const holder = text(request.form.holder) ?? visitorName ?? text(request.form.plate) ?? text(request.form.qid);
  if (!holder) return undefined;
  const plots = [request.plotId, text(request.form.plot)].filter((id): id is string => id !== undefined);
  const matches = passes.filter((pass) => pass.holder === holder && (!plots.length || plots.includes(pass.plotId)));
  return matches.find((pass) => pass.status === 'active') ?? matches[matches.length - 1];
}

const HOUR = 3_600_000;
const SLOT_HOURS = [9, 11.5, 13];

/**
 * Three appointment times to offer: one on each of the next three working days (Sunday to Thursday in
 * Qatar), in the morning, late morning and early afternoon. Times are local.
 */
export function offeredSlots(now: number): number[] {
  const slots: number[] = [];
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  while (slots.length < 3) {
    day.setDate(day.getDate() + 1);
    const weekday = day.getDay();
    if (weekday === 5 || weekday === 6) continue;
    const hours = SLOT_HOURS[slots.length] as number;
    slots.push(day.getTime() + hours * HOUR);
  }
  return slots;
}
