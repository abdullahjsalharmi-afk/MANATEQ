/**
 * Effects — what happens in the investor's world when a request starts, waits, finishes or stops, and
 * when the investor completes one of the atomic tasks of a step (pay, sign, rate …).
 *
 * The engine only moves requests through their workflows; these small functions are the consequences:
 * a plot is reserved, a lease is created, an invoice is raised, a pass is issued. They are kept as
 * tables keyed by service or by task, so adding a consequence never means touching the tick loop.
 * All of them are pure: world in, world out.
 */
import type { ActionAtom, ServiceDetail, ServiceId, StepAction } from '@/data/types';
import { receiptDoc } from '@/domain/documents';
import type { AppNotification, FormValue, Invoice, Lease, Pass, PassKind, Plot, PlotStatus, RequestState, World } from '@/domain/types';
import { allocate, invoiceRef, leaseRef, passCode, receiptRefFor } from './refs';
import { dateText, dots, fill, moneyText, rentTitle, text } from './strings';
import type { ActPayload, PassInput } from './types';
import {
  DAY,
  PAYMENT_TERM_MS,
  addDocs,
  addYears,
  annualRentOf,
  billingPeriod,
  docFacts,
  findLease,
  findPlotRecord,
  findRequest,
  leaseOfPlot,
  leaseYears,
  notify,
  patchInvoice,
  patchLease,
  patchPlot,
  patchRequest,
  periodRentOf,
  plotFacts,
  rateOf,
  resolveInvoiceAsks,
  startOfDay,
} from './world';

export interface EffectContext {
  /** The request the effect is about. Effects read it fresh from the world: earlier effects may have changed it. */
  id: string;
  service: ServiceDetail;
  at: number;
}

export type Effect = (world: World, ctx: EffectContext) => World;

export interface AtomContext extends EffectContext {
  action: StepAction;
  payload: ActPayload;
}

export type AtomEffect = (world: World, ctx: AtomContext) => World;

/* ───────────────────────────── plots and leases ───────────────────────────── */

const STATUS_RANK: Record<PlotStatus, number> = { reserved: 0, leased: 1, handed_over: 2, building: 3, operating: 4 };

/** A plot's status only ever moves forward. */
function raisePlot(world: World, plotId: string | undefined, status: PlotStatus): World {
  const plot = findPlotRecord(world, plotId);
  if (!plot || STATUS_RANK[plot.status] >= STATUS_RANK[status]) return world;
  return patchPlot(world, plot.id, { status });
}

/** Makes sure the plot of an application exists as a record (reserved), and that its whole thread points at it. */
function ensurePlot(world: World, id: string): { world: World; plot: Plot | undefined } {
  const request = findRequest(world, id);
  if (!request) return { world, plot: undefined };
  const existing = findPlotRecord(world, request.plotId);
  if (existing) return { world, plot: existing };

  const facts = plotFacts(world, request);
  let next = world;
  // The record takes the plot's own number as its id ("AW-117") unless another record holds it already.
  let plotId = facts.id ?? facts.number;
  if (findPlotRecord(next, plotId)) {
    const slot = allocate(next, 'pl');
    next = slot.world;
    plotId = slot.id;
  }
  const plot: Plot = { id: plotId, number: facts.number, zoneCode: facts.zoneCode, areaSqm: facts.areaSqm, solution: facts.solution, status: 'reserved' };
  next = {
    ...next,
    plots: [...next.plots, plot],
    requests: next.requests.map((other) => (other.threadId === request.threadId && other.plotId !== plotId ? { ...other, plotId, zoneCode: facts.zoneCode } : other)),
  };
  return { world: next, plot };
}

/** A6: the offer was accepted and the deposit paid, so the plot is held for the investor. */
const reservePlot: Effect = (world, ctx) => ensurePlot(world, ctx.id).world;

/** Raises the rent invoice of the billing period that starts at `at`. Nothing is raised where Manateq sets no rent. */
export function issueRentInvoice(world: World, lease: Lease, plot: Plot, at: number, requestId?: string): World {
  if (lease.annualRent <= 0) return world;
  const slot = allocate(world, 'inv');
  const invoice: Invoice = {
    id: slot.id,
    ref: invoiceRef(slot.seq, at),
    title: rentTitle(billingPeriod(plot.solution), at, plot.number),
    leaseId: lease.id,
    ...(requestId ? { requestId } : {}),
    amount: periodRentOf(plot.solution, lease.annualRent),
    issuedAt: at,
    dueAt: at + PAYMENT_TERM_MS,
    status: 'due',
  };
  const next = { ...slot.world, invoices: [...slot.world.invoices, invoice] };
  return notify(next, {
    at,
    kind: 'update',
    title: text.invoiceIssued,
    body: dots(invoice.title, moneyText(invoice.amount), fill(text.dueOn, { date: dateText(invoice.dueAt) })),
    route: `/account/payments/${invoice.id}`,
    subject: { invoiceId: invoice.id },
  });
}

/** A7: both parties signed. The lease exists, the plot is leased and the billing schedule starts. */
const createLease: Effect = (world, ctx) => {
  const ensured = ensurePlot(world, ctx.id);
  const plot = ensured.plot;
  if (!plot || findLease(ensured.world, plot.leaseId)) return ensured.world;

  const slot = allocate(ensured.world, 'ls');
  const startsAt = startOfDay(ctx.at);
  const lease: Lease = {
    id: slot.id,
    ref: leaseRef(slot.seq, ctx.at),
    plotId: plot.id,
    startsAt,
    endsAt: addYears(startsAt, leaseYears(plot.solution)) - DAY,
    ratePerSqmYear: rateOf(plot.solution),
    annualRent: annualRentOf(plot.solution, plot.areaSqm),
    status: 'active',
  };
  let next: World = { ...slot.world, leases: [...slot.world.leases, lease] };
  next = patchPlot(next, plot.id, { leaseId: lease.id });
  next = raisePlot(next, plot.id, 'leased');
  return issueRentInvoice(next, lease, { ...plot, leaseId: lease.id }, ctx.at, ctx.id);
};

const plotOf = (world: World, id: string): string | undefined => findRequest(world, id)?.plotId;

/** A8: the handover certificate is signed on site. */
const handOver: Effect = (world, ctx) => raisePlot(world, plotOf(world, ctx.id), 'handed_over');

/** The first design or permit request on a plot marks the start of building. */
const beginBuilding: Effect = (world, ctx) => {
  const plot = findPlotRecord(world, plotOf(world, ctx.id));
  return plot && plot.status !== 'reserved' ? raisePlot(world, plot.id, 'building') : world;
};

/** C8: the building is activated for operations. */
const startOperating: Effect = (world, ctx) => raisePlot(world, plotOf(world, ctx.id), 'operating');

/** What the renewal offer of a lease renewal request (B3) means for its plot. */
export interface RenewalTerms {
  plotId: string;
  /** The new last day of the lease (ms since epoch): one more term after the current end. */
  until: number;
  /** The length of the new term, in years (the solution's published term). */
  years: number;
  /** QAR per m² per year: the rate of the lease, which the renewal keeps. */
  ratePerSqm: number;
  annualRent: number;
  /** What the offer step asks to pay now: the first billing period of the renewed lease. */
  firstInstalment: number;
}

/**
 * The terms a renewal request (B3) offers, by the same rule `renewLease` applies when it finishes: the
 * lease runs one more term of the solution's published length at its current rate. Undefined when the
 * request is not a renewal or its plot has no lease. No incentive is modelled.
 */
export function renewalTerms(world: World, request: RequestState): RenewalTerms | undefined {
  if (request.serviceId !== 'B3') return undefined;
  const plot = findPlotRecord(world, request.plotId);
  const lease = findLease(world, plot?.leaseId);
  if (!plot || !lease) return undefined;
  const years = leaseYears(plot.solution);
  return {
    plotId: plot.id,
    until: addYears(lease.endsAt + DAY, years) - DAY,
    years,
    ratePerSqm: lease.ratePerSqmYear,
    annualRent: lease.annualRent,
    firstInstalment: request.amount ?? periodRentOf(plot.solution, lease.annualRent),
  };
}

/** B3: the addendum is countersigned, so the lease runs for another term. */
const renewLease: Effect = (world, ctx) => {
  const request = findRequest(world, ctx.id);
  const terms = request ? renewalTerms(world, request) : undefined;
  const lease = leaseOfPlot(world, terms?.plotId);
  if (!terms || !lease) return world;
  return patchLease(world, lease.id, { endsAt: terms.until, status: 'active' });
};

/** B7: the clearance certificate closes the lease. */
const endLease: Effect = (world, ctx) => {
  const lease = leaseOfPlot(world, plotOf(world, ctx.id));
  return lease ? patchLease(world, lease.id, { status: 'ended', endsAt: Math.min(lease.endsAt, startOfDay(ctx.at)) }) : world;
};

/**
 * An application that stops before the lease exists gives the held plot back. The requests that named
 * it keep the plot's number from the zone's layout, which is what they asked for.
 */
const releasePlot: Effect = (world, ctx) => {
  const plot = findPlotRecord(world, plotOf(world, ctx.id));
  if (!plot || plot.status !== 'reserved' || plot.leaseId) return world;
  return {
    ...world,
    plots: world.plots.filter((other) => other.id !== plot.id),
    requests: world.requests.map((request) => (request.plotId === plot.id && plot.id !== plot.number ? { ...request, plotId: plot.number } : request)),
  };
};

/* ───────────────────────────── gate passes ───────────────────────────── */

/** Adds a pass to the wallet. A pass whose validity already ended is filed as expired. */
export function addPass(world: World, input: PassInput, at: number): { world: World; id: string } {
  const slot = allocate(world, 'gp');
  const pass: Pass = { ...input, id: slot.id, status: input.to < at ? 'expired' : 'active', code: passCode(slot.seq) };
  return { world: { ...slot.world, passes: [...slot.world.passes, pass] }, id: slot.id };
}

const PASS_KIND: Record<string, PassKind> = { worker: 'worker', vehicle: 'vehicle', visitor: 'visitor' };

const asText = (value: FormValue | undefined): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const personName = (value: FormValue | undefined): string | undefined => (value !== null && typeof value === 'object' && value.name.trim() ? value.name.trim() : undefined);
const personId = (value: FormValue | undefined): string | undefined => (value !== null && typeof value === 'object' && 'id' in value ? asText(value.id) : undefined);

/** A date answer as a time: a number is ms since epoch; "2026-11-19" is that day on this device. */
export function toTime(value: FormValue | undefined, endOfDay = false): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (day) {
    const start = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime();
    return endOfDay ? start + DAY - 1 : start;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** D2: the pass is live at the gates. Built from the request's answers; never issued twice for the same request. */
const issueRequestedPass: Effect = (world, ctx) => {
  const request = findRequest(world, ctx.id);
  if (!request) return world;
  const form = request.form;
  const kind = PASS_KIND[asText(form.passType) ?? ''] ?? 'visitor';
  const plate = asText(form.plate);
  const holder = asText(form.holder) ?? personName(form.visitor) ?? (kind === 'vehicle' ? plate : undefined) ?? asText(form.qid) ?? request.ref;
  const idOrPlate = kind === 'vehicle' ? plate : (asText(form.qid) ?? personId(form.visitor));
  const company = asText(form.company);
  const from = toTime(form.validFrom) ?? ctx.at;
  const to = toTime(form.validTo, true) ?? from + (kind === 'visitor' ? DAY : 90 * DAY);
  // A pass is for one of the investor's plots: the one the request names, or else the first one held.
  const plotId = findPlotRecord(world, request.plotId)?.id ?? findPlotRecord(world, asText(form.plot))?.id ?? world.plots.find((plot) => plot.leaseId !== undefined)?.id;
  if (plotId === undefined) return world;
  // The request already has its pass (issued on the spot when it was sent), whatever became of it since.
  if (world.passes.some((pass) => pass.requestId === request.id)) return world;
  const duplicate = world.passes.some((pass) => pass.kind === kind && pass.holder === holder && pass.plotId === plotId && pass.from === from && pass.status !== 'revoked');
  if (duplicate) return world;
  return addPass(world, { kind, holder, ...(idOrPlate ? { idOrPlate } : {}), ...(company ? { company } : {}), plotId, from, to, requestId: request.id }, ctx.at).world;
};

/**
 * D2 withdrawn: the pass its request issued no longer opens the gate. A request and its pass never disagree:
 * a closed request with a pass still live at the gates would be one.
 */
const revokeRequestedPasses: Effect = (world, ctx) => {
  if (!world.passes.some((pass) => pass.requestId === ctx.id && pass.status === 'active')) return world;
  return { ...world, passes: world.passes.map((pass) => (pass.requestId === ctx.id && pass.status === 'active' ? { ...pass, status: 'revoked' } : pass)) };
};

/* ───────────────────────────── money ───────────────────────────── */

/** Amounts the sources do not publish. They are illustrative, like every amount in the demo. */
const ILLUSTRATIVE_QAR = { fee: 2500, fine: 1000, other: 500 } as const;

/**
 * The amount a `pay` task asks for. The deposit is one quarter of the annual rent; a renewal asks for
 * the first billing period; a balance is what is outstanding on the lease.
 */
export function amountFor(world: World, request: RequestState, action: Pick<StepAction, 'amount'>): number {
  const plot = findPlotRecord(world, request.plotId);
  const lease = findLease(world, plot?.leaseId);
  const facts = plot ?? plotFacts(world, request);
  const annualRent = lease?.annualRent ?? annualRentOf(facts.solution, facts.areaSqm);
  switch (action.amount?.basis) {
    case 'deposit':
      return Math.round(annualRent / 4);
    case 'rent':
      return periodRentOf(facts.solution, annualRent);
    case 'balance': {
      const dues = world.invoices.filter((invoice) => invoice.status !== 'paid' && lease !== undefined && invoice.leaseId === lease.id).reduce((sum, invoice) => sum + invoice.amount, 0);
      return dues > 0 ? dues : Math.round(annualRent / 12);
    }
    case 'fee':
      return ILLUSTRATIVE_QAR.fee;
    case 'fine':
      return ILLUSTRATIVE_QAR.fine;
    default:
      return ILLUSTRATIVE_QAR.other;
  }
}

/**
 * Once only: a deposit already paid in the same thread (with the offer, A6) is not asked for again when
 * the guarantee task of the new contract (B2) offers to pay one. Returns the paid invoice, or undefined.
 */
export function depositPaidWith(world: World, request: RequestState): Invoice | undefined {
  const offers = new Set(world.requests.filter((other) => other.id !== request.id && other.threadId === request.threadId && other.serviceId === 'A6').map((other) => other.id));
  if (!offers.size) return undefined;
  return world.invoices.find((invoice) => invoice.requestId !== undefined && offers.has(invoice.requestId) && invoice.status === 'paid');
}

export const depositPaidInThread = (world: World, request: RequestState): boolean => depositPaidWith(world, request) !== undefined;

/**
 * When a request starts waiting on a step that includes a payment, the amount is fixed and shown before
 * paying. A deposit already paid with the offer is not fixed again: the step records the receipt that
 * covers it instead, and asks for no payment (see `stepTasks`).
 */
export const whenWaiting = (world: World, ctx: EffectContext & { action: StepAction | undefined }): World => {
  const request = findRequest(world, ctx.id);
  if (!request || !ctx.action?.flow.includes('pay')) return world;
  if (ctx.action.amount?.basis === 'deposit') {
    const paid = depositPaidWith(world, request);
    if (paid) return paid.receiptDocId !== undefined ? patchRequest(world, ctx.id, { prepaidDocId: paid.receiptDocId }) : world;
  }
  return patchRequest(world, ctx.id, { amount: amountFor(world, request, ctx.action) });
};

/** Marks an invoice paid and files its receipt. Returns the receipt's document id. */
export function settleInvoice(world: World, invoiceId: string, at: number, source?: { serviceId: ServiceId; requestId: string }): { world: World; docId: string | null } {
  const invoice = world.invoices.find((candidate) => candidate.id === invoiceId);
  if (!invoice || invoice.status === 'paid') return { world, docId: null };
  const slot = allocate(world, 'd');
  const paid: Invoice = { ...invoice, status: 'paid', paidAt: at, receiptDocId: slot.id };
  const plotId = findLease(slot.world, invoice.leaseId)?.plotId ?? (source ? findRequest(slot.world, source.requestId)?.plotId : undefined);
  const receipt = receiptDoc({ id: slot.id, ref: receiptRefFor(invoice.ref) }, paid, docFacts(slot.world, plotId), at, source);
  let next = patchInvoice(slot.world, invoice.id, paid);
  next = addDocs(next, [receipt]);
  // A reminder to pay this invoice has been answered.
  next = resolveInvoiceAsks(next, invoice.id, at);
  return { world: next, docId: slot.id };
}

/**
 * The investor pays an invoice, on whichever screen: it is settled with its receipt, and a short note,
 * already read (the investor just did it), opens the receipt in the wallet. History that is seeded as
 * already paid uses `settleInvoice` and raises nothing.
 */
export function payInvoiceNoted(world: World, invoiceId: string, at: number, source?: { serviceId: ServiceId; requestId: string }): { world: World; docId: string | null } {
  const invoice = world.invoices.find((candidate) => candidate.id === invoiceId);
  const paid = settleInvoice(world, invoiceId, at, source);
  if (!invoice || paid.docId === null) return paid;
  // The note is named after its receipt, not numbered: it takes nothing from the sequence that numbers
  // requests and documents, so the same history always gives the same ids.
  const note: AppNotification = {
    id: `pay-${paid.docId}`,
    at,
    kind: 'done',
    title: text.paymentReceived,
    body: dots(invoice.title, moneyText(invoice.amount)),
    route: `/account/wallet/${paid.docId}`,
    subject: { invoiceId },
    read: true,
  };
  return { world: { ...paid.world, notifications: [...paid.world.notifications, note] }, docId: paid.docId };
}

/** `pay` of an outstanding balance: the unpaid invoices of the lease are settled, each with its receipt. */
function settleBalance(world: World, request: RequestState, ctx: AtomContext): World | undefined {
  const lease = leaseOfPlot(world, request.plotId);
  const unpaid = lease ? world.invoices.filter((invoice) => invoice.leaseId === lease.id && invoice.status !== 'paid') : [];
  if (!unpaid.length) return undefined;
  let next = world;
  const receipts: string[] = [];
  for (const invoice of unpaid) {
    const settled = payInvoiceNoted(next, invoice.id, ctx.at, { serviceId: ctx.service.id, requestId: request.id });
    next = settled.world;
    if (settled.docId !== null) receipts.push(settled.docId);
  }
  const amount = unpaid.reduce((sum, invoice) => sum + invoice.amount, 0);
  return patchRequest(next, request.id, { amount, docIds: [...request.docIds, ...receipts] });
}

/** `pay`: a paid invoice for the amount of the step, with its receipt, filed against the request. */
const collectPayment: AtomEffect = (world, ctx) => {
  const request = findRequest(world, ctx.id);
  if (!request) return world;
  if (ctx.action.amount?.basis === 'deposit' && depositPaidInThread(world, request)) return world;
  if (ctx.action.amount?.basis === 'balance') {
    const settled = settleBalance(world, request, ctx);
    if (settled) return settled;
  }
  const amount = request.amount ?? amountFor(world, request, ctx.action);
  if (amount <= 0) return world;

  const slot = allocate(world, 'inv');
  const plotNumber = findPlotRecord(slot.world, request.plotId)?.number ?? (request.plotId !== undefined ? plotFacts(slot.world, request).number : undefined);
  const leaseId = leaseOfPlot(slot.world, request.plotId)?.id;
  const invoice: Invoice = {
    id: slot.id,
    ref: invoiceRef(slot.seq, ctx.at),
    title: dots(ctx.action.amount?.label ?? text.payment, plotNumber),
    ...(leaseId ? { leaseId } : {}),
    requestId: request.id,
    amount,
    issuedAt: ctx.at,
    dueAt: ctx.at,
    status: 'due',
  };
  const settled = payInvoiceNoted({ ...slot.world, invoices: [...slot.world.invoices, invoice] }, invoice.id, ctx.at, { serviceId: ctx.service.id, requestId: request.id });
  if (settled.docId === null) return settled.world;
  return patchRequest(settled.world, request.id, { amount, docIds: [...request.docIds, settled.docId] });
};

/* ───────────────────────────── the investor's answers ───────────────────────────── */

/** Records everything the investor handed over with a step, before the step's own tasks run. */
export function recordPayload(world: World, id: string, step: number, payload: ActPayload): World {
  const request = findRequest(world, id);
  if (!request) return world;
  const form: Record<string, FormValue> = { ...request.form, ...(payload.form ?? {}) };
  if (payload.choice !== undefined) form.choice = payload.choice;
  (payload.files ?? []).forEach((file, index) => {
    form[`upload${step}.${index + 1}`] = { name: file.name, ...(file.size !== undefined ? { size: file.size } : {}) };
  });
  return patchRequest(world, id, { form });
}

const recordSignature: AtomEffect = (world, ctx) => {
  const request = findRequest(world, ctx.id);
  return request ? patchRequest(world, ctx.id, { form: { ...request.form, signedAt: ctx.at } }) : world;
};

const recordAcceptance: AtomEffect = (world, ctx) => {
  const request = findRequest(world, ctx.id);
  return request ? patchRequest(world, ctx.id, { form: { ...request.form, acceptedAt: ctx.at } }) : world;
};

const saveRating: AtomEffect = (world, ctx) => {
  const given = ctx.payload.rating;
  if (given === undefined) return world;
  const rating = typeof given === 'number' ? { stars: given } : given;
  const stars = Math.max(1, Math.min(5, Math.round(rating.stars)));
  return patchRequest(world, ctx.id, { rating: { stars, ...(rating.comment?.trim() ? { comment: rating.comment.trim() } : {}) } });
};

/* ───────────────────────────── the tables ───────────────────────────── */

/** When a request of the service is created. */
export const whenStarted: Partial<Record<ServiceId, Effect>> = {
  C1: beginBuilding,
  C2: beginBuilding,
  C3: beginBuilding,
  C6: beginBuilding,
};

/** When a request of the service reaches its end. Documents and followers come after, for every service. */
export const whenFinished: Partial<Record<ServiceId, Effect>> = {
  A6: reservePlot,
  A7: createLease,
  A8: handOver,
  B3: renewLease,
  B7: endLease,
  C8: startOperating,
  D2: issueRequestedPass,
};

/** When a request of the service is closed without its usual outcome (declined, expired, cancelled). */
export const whenStopped: Partial<Record<ServiceId, Effect>> = {
  A4: releasePlot,
  A5: releasePlot,
  A6: releasePlot,
  A7: releasePlot,
  D2: revokeRequestedPasses,
};

/** When the investor completes a step: one effect per atomic task of the step's flow. */
export const atomEffects: Partial<Record<ActionAtom, AtomEffect>> = {
  accept: recordAcceptance,
  pay: collectPayment,
  sign: recordSignature,
  rate: saveRating,
};
