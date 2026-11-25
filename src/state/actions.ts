/**
 * Everything that changes the app state. Components never call `setState` directly.
 *
 * Each action reads the clock once, hands the world to a pure reducer (`sim.ts`) and stores the
 * result. An action that changes nothing leaves the state object untouched, so nothing re-renders.
 */
import { peekServiceDetail } from '@/data/catalog';
import type { Lang, ServiceDetail, ServiceId } from '@/data/types';
import { timingFor } from '@/domain/simulation';
import type { AppState, Draft, EligibilityResult, FormValue, Persona, TextSize, ThemeChoice, World } from '@/domain/types';
import type { Timing } from '@/domain/workflow';
import { markCatalogueReady } from './catalogue';
import { completeSeed, emptyWorld, seedIsPartial, seedWorld } from './seed';
import { actIn, bookAppointmentIn, cancelAppointmentIn, cancelIn, fastForwardIn, issuePassIn, payInvoiceIn, resumeIn, revokePassIn, startIn, tickWorld } from './sim';
import { setState } from './store';
import type { ActPayload, AppointmentInput, Env, PassInput, StartOptions } from './types';

/* ───────────────────────────── plumbing ───────────────────────────── */

const timings = new Map<string, Timing>();

/** Demo time at the current speed. Timings are remembered per service: working one out walks the whole workflow. */
function liveEnv(speed: number): Env {
  return {
    detail: peekServiceDetail,
    timing(service: ServiceDetail): Timing {
      const key = `${service.id}@${speed}`;
      let timing = timings.get(key);
      if (!timing) {
        if (timings.size > 400) timings.clear();
        timing = timingFor(service, speed);
        timings.set(key, timing);
      }
      return timing;
    },
  };
}

/** Applies a change to the world; the state object is replaced only when the world really changed. */
function changeWorld(update: (world: World, state: AppState) => World): void {
  setState((state) => {
    const world = update(state.world, state);
    return world === state.world ? state : { ...state, world };
  });
}

/* ───────────────────────────── settings ───────────────────────────── */

export function setLang(lang: Lang): void {
  setState((s) => (s.settings.lang === lang ? s : { ...s, settings: { ...s.settings, lang } }));
}

export function setTheme(theme: ThemeChoice): void {
  setState((s) => (s.settings.theme === theme ? s : { ...s, settings: { ...s.settings, theme } }));
}

export function setTextSize(textSize: TextSize): void {
  setState((s) => (s.settings.textSize === textSize ? s : { ...s, settings: { ...s.settings, textSize } }));
}

export function setNotifications(notifications: boolean): void {
  setState((s) => (s.settings.notifications === notifications ? s : { ...s, settings: { ...s.settings, notifications } }));
}

/* ───────────────────────────── session ───────────────────────────── */

/** Finishes the welcome screen as a guest or with a demo profile: the profile's world is seeded afresh. */
export function enterAs(persona: Persona): void {
  const now = Date.now();
  setState((s) => ({ ...s, settings: { ...s.settings, onboarded: true }, world: seedWorld(persona, now) }));
}

/** Back to the welcome screen. Settings stay; the demo world is dropped. */
export function signOut(): void {
  setState((s) => ({ ...s, settings: { ...s.settings, onboarded: false }, world: emptyWorld('guest') }));
}

/** Starts the current demo profile again from the beginning, at normal speed. */
export function resetDemo(): void {
  const now = Date.now();
  setState((s) => ({ ...s, world: seedWorld(s.world.persona, now), demo: { ...s.demo, speed: 1 } }));
}

/** Simulation speed: 1 is the normal demo pace, larger is faster, 0 pauses. */
export function setSpeed(speed: number): void {
  const next = Number.isFinite(speed) ? Math.max(0, speed) : 1;
  const now = Date.now();
  setState((s) => {
    if (s.demo.speed === next) return s;
    // Leaving a pause: steps take their time from now on instead of all finishing at once.
    const world = s.demo.speed <= 0 && next > 0 ? resumeIn(s.world, now, liveEnv(next)) : s.world;
    return { ...s, world, demo: { ...s.demo, speed: next } };
  });
}

/* ───────────────────────────── requests ───────────────────────────── */

/**
 * Starts a service. Returns the new request's id; the request is already moving.
 * For a land application, `opts.plotId` is the available plot the investor picked ("AW-117").
 */
export function startRequest(serviceId: ServiceId, form: Record<string, FormValue> = {}, opts: StartOptions = {}): string {
  const now = Date.now();
  let id = '';
  setState((s) => {
    const started = startIn(s.world, { serviceId, form, ...opts }, now, liveEnv(s.demo.speed));
    id = started.id;
    let world = started.world;
    if (serviceId in world.drafts) {
      // The draft became the request.
      const { [serviceId]: _sent, ...drafts } = world.drafts;
      world = { ...world, drafts };
    }
    return { ...s, world };
  });
  return id;
}

/**
 * Completes the step the request is waiting on the investor for: records what they handed over,
 * applies the step's tasks (a payment becomes a paid invoice with its receipt, a signature is
 * recorded, a rating is saved) and moves the request on. Returns false when there was nothing to do.
 */
export function actOnRequest(requestId: string, payload: ActPayload = {}): boolean {
  const now = Date.now();
  let acted = false;
  changeWorld((world, state) => {
    const next = actIn(world, requestId, payload, now, liveEnv(state.demo.speed));
    acted = next !== world;
    return next;
  });
  return acted;
}

/** What completing a step produced. */
export interface StepResult {
  /** False when there was nothing to do. */
  ok: boolean;
  /** The receipts the step's payment filed in the wallet (several when a balance settles several invoices), oldest first. */
  receiptDocIds: string[];
}

/**
 * `actOnRequest`, telling what the step produced: run it when the payment sheet confirms, then show
 * the receipt that was really filed (`selectDoc(receiptDocIds.at(-1))?.ref`, "RCP-2026-0101").
 */
export function completeStep(requestId: string, payload: ActPayload = {}): StepResult {
  const now = Date.now();
  let result: StepResult = { ok: false, receiptDocIds: [] };
  changeWorld((world, state) => {
    const next = actIn(world, requestId, payload, now, liveEnv(state.demo.speed));
    if (next === world) return world;
    const before = new Set(world.docs.map((doc) => doc.id));
    const receiptDocIds = next.docs.filter((doc) => doc.kind === 'receipt' && !before.has(doc.id) && doc.requestId === requestId).map((doc) => doc.id);
    result = { ok: true, receiptDocIds };
    return next;
  });
  return result;
}

/** Demo control: the step that is open with Manateq or another entity finishes now. */
export function fastForwardRequest(requestId: string): void {
  const now = Date.now();
  changeWorld((world, state) => fastForwardIn(world, requestId, now, liveEnv(state.demo.speed)));
}

/** Withdraws a request that has not finished. */
export function cancelRequest(requestId: string): void {
  const now = Date.now();
  changeWorld((world, state) => cancelIn(world, requestId, now, liveEnv(state.demo.speed)));
}

/**
 * Advances the simulation: called once a second by the app shell. Completes a demo world that was
 * seeded before the workflows were in memory, moves every open request, and lets the calendar act.
 * Does nothing (and re-renders nothing) when nothing is due, or while the simulation is paused.
 */
export function tick(now: number): void {
  changeWorld((world, state) => {
    const seeded = seedIsPartial(world) ? completeSeed(world, now) : world;
    // A world still waiting for its history stands still: it is about to be replaced.
    if (seedIsPartial(seeded) || state.demo.speed <= 0) return seeded;
    return tickWorld(seeded, now, liveEnv(state.demo.speed));
  });
}

/**
 * Every workflow is now in memory (called once from `boot.ts`). Requests that were waiting for their
 * workflow start moving, and every subscriber reads again, because what selectors derive from the
 * catalogue has changed even where the world has not.
 */
export function catalogueLoaded(now: number = Date.now()): void {
  markCatalogueReady();
  tick(now);
  setState((s) => ({ ...s }));
}

/* ───────────────────────────── invoices ───────────────────────────── */

/** Pays an invoice (a demo payment: no money moves). Returns the id of the receipt in the wallet, or null. */
export function payInvoice(invoiceId: string): string | null {
  const now = Date.now();
  let receipt: string | null = null;
  changeWorld((world) => {
    const paid = payInvoiceIn(world, invoiceId, now);
    receipt = paid.docId;
    return paid.world;
  });
  return receipt;
}

/* ───────────────────────────── gate passes ───────────────────────────── */

/** Issues a pass straight into the wallet. Returns its id. */
export function issuePass(input: PassInput): string {
  const now = Date.now();
  let id = '';
  changeWorld((world) => {
    const issued = issuePassIn(world, input, now);
    id = issued.id;
    return issued.world;
  });
  return id;
}

export function revokePass(id: string): void {
  changeWorld((world) => revokePassIn(world, id));
}

/* ───────────────────────────── notifications ───────────────────────────── */

export function markRead(id: string): void {
  changeWorld((world) => {
    if (!world.notifications.some((notification) => notification.id === id && !notification.read)) return world;
    return { ...world, notifications: world.notifications.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)) };
  });
}

export function markAllRead(): void {
  changeWorld((world) => {
    if (!world.notifications.some((notification) => !notification.read)) return world;
    return { ...world, notifications: world.notifications.map((notification) => (notification.read ? notification : { ...notification, read: true })) };
  });
}

/* ───────────────────────────── appointments ───────────────────────────── */

/** Books a Business Services Center appointment. Returns its id. */
export function bookAppointment(input: AppointmentInput): string {
  let id = '';
  changeWorld((world) => {
    const booked = bookAppointmentIn(world, input);
    id = booked.id;
    return booked.world;
  });
  return id;
}

export function cancelAppointment(id: string): void {
  changeWorld((world) => cancelAppointmentIn(world, id));
}

/* ───────────────────────────── drafts ───────────────────────────── */

/** Keeps a started-but-unsent form. One draft per service; saving again replaces it. */
export function saveDraft(serviceId: ServiceId, form: Record<string, FormValue>, page?: number): void;
export function saveDraft(draft: Pick<Draft, 'serviceId' | 'form'> & { page?: number }): void;
export function saveDraft(first: ServiceId | (Pick<Draft, 'serviceId' | 'form'> & { page?: number }), form: Record<string, FormValue> = {}, page = 0): void {
  const now = Date.now();
  const draft: Draft = typeof first === 'string' ? { serviceId: first, form, page, savedAt: now } : { serviceId: first.serviceId, form: first.form, page: first.page ?? 0, savedAt: now };
  changeWorld((world) => ({ ...world, drafts: { ...world.drafts, [draft.serviceId]: draft } }));
}

export function clearDraft(serviceId: ServiceId): void {
  changeWorld((world) => {
    if (!(serviceId in world.drafts)) return world;
    const { [serviceId]: _dropped, ...drafts } = world.drafts;
    return { ...world, drafts };
  });
}

/* ───────────────────────────── eligibility, zones, team ───────────────────────────── */

/** Keeps the latest eligibility result on the profile; the land application starts from it. */
export function saveEligibility(result: Omit<EligibilityResult, 'at'> & { at?: number }): void {
  const now = Date.now();
  changeWorld((world) => ({ ...world, eligibility: { ...result, at: result.at ?? now } }));
}

/** "Update now" on the company profile: the demo re-reads the register and stamps the time. */
export function syncCompany(): void {
  const now = Date.now();
  changeWorld((world) => (world.company ? { ...world, company: { ...world.company, syncedAt: now } } : world));
}

/** Follows or unfollows a zone for availability alerts. */
export function toggleWatchZone(code: string): void {
  changeWorld((world) => ({ ...world, watchedZones: world.watchedZones.includes(code) ? world.watchedZones.filter((zone) => zone !== code) : [...world.watchedZones, code] }));
}

/** Gives or withdraws a team member's mandate to act for the company. The owner always keeps theirs. */
export function setDelegated(memberId: string, on: boolean): void {
  changeWorld((world) => {
    const member = world.team.find((candidate) => candidate.id === memberId);
    if (!member || member.scope === 'owner' || member.delegated === on) return world;
    return { ...world, team: world.team.map((candidate) => (candidate.id === memberId ? { ...candidate, delegated: on } : candidate)) };
  });
}
