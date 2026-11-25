/**
 * Pure helpers of the requests feature: how the list groups a thread, how far along its chain a
 * request is, which tasks the action runner asks for and whether a request has a day clock. No React,
 * no store: everything here is unit-tested.
 */
import { chainFrom, unlocks } from '@/domain/chains';
import type { ActionAtom, ServiceId, StepAction } from '@/data/types';
import type { RequestState } from '@/domain/types';
import type { Formatters } from '@/app/i18n';
import type { RenewalTerms } from '@/state';

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

/**
 * Whether the request's clock is a real "day n of m" countdown worth a ring and a figure. A standard with
 * no duration (the building permit's "within one working day of each Ministry event") has a null target.
 */
export function hasDayClock(clock: { ratio: number | null; targetDays: number | null } | undefined): boolean {
  return clock !== undefined && clock.ratio !== null && clock.targetDays !== null && clock.targetDays > 0;
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

/* ───────────────────────────── the renewal offer ───────────────────────────── */

/** The plural forms of a lease term in years. */
export const yearsCount = {
  ar: { one: 'سنة واحدة', two: 'سنتان', few: '{n} سنوات', many: '{n} سنة', other: '{n} سنة' },
  en: { one: '{n} year', other: '{n} years' },
};

export type RenewalWord = 'renewUntil' | 'renewTerm' | 'renewRate' | 'renewRateValue' | 'renewRent' | 'renewFirst';

export interface TextLine {
  label: string;
  value: string;
}

/**
 * What the investor agrees to when accepting a lease renewal (B3), from `selectRenewalTerms`: the new end date
 * and the term, the rate per square metre and the yearly rent, and the first instalment (left out when the
 * payment line of the sheet already shows it). No incentive is modelled, so none is named.
 */
export function renewalLines(terms: RenewalTerms, fmt: Pick<Formatters, 'date' | 'money' | 'plural'>, t: (key: RenewalWord, vars?: Record<string, string>) => string, withInstalment: boolean): TextLine[] {
  return [
    { label: t('renewUntil'), value: fmt.date(terms.until) },
    { label: t('renewTerm'), value: fmt.plural(terms.years, yearsCount) },
    { label: t('renewRate'), value: t('renewRateValue', { amount: fmt.money(terms.ratePerSqm) }) },
    { label: t('renewRent'), value: fmt.money(terms.annualRent) },
    ...(withInstalment ? [{ label: t('renewFirst'), value: fmt.money(terms.firstInstalment) }] : []),
  ];
}

/* ───────────────────────────── a rating that reopened the request ───────────────────────────── */

export interface RatingFacts {
  /** The line the tile adds while the request is open again after a low rating. */
  reopened: 'reopenedSupervisor' | 'reopened' | undefined;
  /** The rating to show on the page (the latest one given), if any. */
  rating: { stars: number; comment?: string } | undefined;
  /** How the shown rating relates to the reopening: it did it, or an earlier rating did. */
  ratingNote: 'ratingReopenedThis' | 'ratingReopenedEarlier' | undefined;
  /** The open step asks for a rating again, after a rating reopened the request. */
  askAgain: boolean;
}

/**
 * What the request page says about ratings: a low rating (D1, 1 or 2 stars) reopens the report for the
 * supervisor. While it is open again the tile says so (and, while the supervisor holds it, names them);
 * the rating the investor gave is shown; when the workflow comes back to the rating step it asks again.
 */
export function ratingFacts(
  request: Pick<RequestState, 'status' | 'rating' | 'reopenedAt' | 'reopenedRating'>,
  holderLane: string | undefined,
  action: Pick<StepAction, 'flow'> | null,
): RatingFacts {
  const open = request.status === 'active' || request.status === 'needs_you';
  const reopenedOnce = request.reopenedAt !== undefined;
  const askAgain = open && reopenedOnce && action !== null && action.flow.includes('rate');
  let reopened: RatingFacts['reopened'];
  if (open && reopenedOnce && !askAgain) reopened = holderLane === 'staff' ? 'reopenedSupervisor' : 'reopened';
  const rating = request.rating;
  let ratingNote: RatingFacts['ratingNote'];
  if (rating && request.reopenedRating) {
    const same = rating.stars === request.reopenedRating.stars && (rating.comment ?? '') === (request.reopenedRating.comment ?? '');
    ratingNote = same ? 'ratingReopenedThis' : 'ratingReopenedEarlier';
  }
  return { reopened, rating, ratingNote, askAgain };
}
