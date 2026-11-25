/**
 * The next step — everything the investor should do, from any source, most urgent first:
 * requests waiting for them, invoices to pay, a renewal to accept, and (when nothing is waiting) the
 * service that moves their journey forward. Home shows the first; the rest sit behind "and n more".
 *
 * Order: overdue first, then the nearest deadline, then the request that has waited longest, then
 * suggestions. Pure: the catalogue lookup is passed in, because full service records load on demand.
 */
import { langTools, ltr } from '@/app/i18n';
import { getService } from '@/data/catalog';
import type { L10n, ServiceDetail, ServiceId, StepAction } from '@/data/types';
import { journeyOf } from './journey';
import { leaseOfPlot } from './plots';
import { nextStepText as COPY } from './strings';
import { DOT, keepWhole } from './text';
import type { Invoice, NextStep, RequestState, World } from './types';
import { currentVisit } from './workflow';

const AR = langTools('ar').fmt;
const EN = langTools('en').fmt;

const DAY = 86_400_000;

/** How long a plot offer stays open for acceptance (illustrative). */
export const OFFER_VALIDITY_MS = 14 * DAY;

export type DetailLookup = (id: ServiceId) => ServiceDetail | undefined;

/** Urgency bands: a lower number sorts first. Within a band, the timestamp decides. */
const BAND = { overdue: 0, deadline: 1, waiting: 2, suggestion: 3, draft: 4 } as const;
const BAND_SIZE = 1e14;

const join = (parts: (L10n | undefined)[]): L10n => {
  const present = parts.filter((part): part is L10n => part !== undefined);
  return { ar: present.map((part) => part.ar).join(DOT), en: present.map((part) => part.en).join(DOT) };
};
const plotName = (number: string | undefined): L10n | undefined => (number ? { ar: ltr(number), en: keepWhole(number) } : undefined);
const money = (amount: number | undefined): L10n | undefined => (amount ? { ar: keepWhole(AR.money(amount)), en: keepWhole(EN.money(amount)) } : undefined);

/** What the app asks of the investor at the step a request is waiting on. */
export function pendingAction(request: RequestState, service: Pick<ServiceDetail, 'actions'> | undefined): StepAction | undefined {
  if (request.status !== 'needs_you' || request.current === null || !service) return undefined;
  return service.actions.find((action) => action.step === request.current);
}

/**
 * The date by which the investor must act on a waiting request, when there is one: a renewal before
 * the lease ends, an offer before it lapses.
 */
export function deadlineOf(world: World, request: RequestState): number | undefined {
  if (request.status !== 'needs_you') return undefined;
  if (request.serviceId === 'B3') return leaseOfPlot(world, request.plotId)?.endsAt;
  if (request.serviceId === 'A6') {
    const open = currentVisit(request);
    return open ? open.enteredAt + OFFER_VALIDITY_MS : undefined;
  }
  return undefined;
}

function requestStep(world: World, request: RequestState, lookup: DetailLookup): NextStep {
  const summary = getService(request.serviceId);
  const action = pendingAction(request, lookup(request.serviceId));
  const plot = world.plots.find((candidate) => candidate.id === request.plotId);
  const dueAt = deadlineOf(world, request);
  const waitingSince = currentVisit(request)?.enteredAt ?? request.updatedAt;
  const title = action?.title ?? summary?.label ?? { ar: request.ref, en: request.ref };
  return {
    id: `request:${request.id}`,
    kind: request.serviceId === 'B3' ? 'renewal' : 'request_action',
    title,
    // An application names the plot it picked before the plot is on record.
    context: join([action ? summary?.label : undefined, plotName(plot?.number ?? request.plotId), money(request.amount)]),
    cta: action?.cta ?? COPY.openRequest,
    route: `/requests/${request.id}`,
    urgency: dueAt !== undefined ? BAND.deadline * BAND_SIZE + dueAt : BAND.waiting * BAND_SIZE + waitingSince,
    ...(dueAt !== undefined ? { dueAt } : {}),
  };
}

function invoiceStep(invoice: Invoice): NextStep {
  const overdue = invoice.status === 'overdue';
  return {
    id: `invoice:${invoice.id}`,
    kind: 'invoice',
    title: overdue ? COPY.payOverdue : COPY.payInvoice,
    context: join([invoice.title, money(invoice.amount)]),
    cta: COPY.pay,
    route: `/account/payments/${invoice.id}`,
    invoiceId: invoice.id,
    urgency: (overdue ? BAND.overdue : BAND.deadline) * BAND_SIZE + invoice.dueAt,
    dueAt: invoice.dueAt,
  };
}

/** Where a service is started: the eligibility check has its own screen, everything else the start flow. */
export function startRoute(serviceId: ServiceId, plotId?: string | null): string {
  if (serviceId === 'A2') return '/eligibility';
  return plotId ? `/start/${serviceId}?plot=${encodeURIComponent(plotId)}` : `/start/${serviceId}`;
}

function suggestionSteps(world: World): NextStep[] {
  const journey = journeyOf(world);
  const plot = world.plots.find((candidate) => candidate.id === journey.plotId);
  const steps: NextStep[] = [];
  let order = 0;
  for (const station of journey.stations) {
    for (const item of station.items) {
      order++;
      if (!item.canStart || world.drafts[item.serviceId]) continue;
      const service = getService(item.serviceId);
      if (!service) continue;
      steps.push({
        id: `start:${item.serviceId}${plot ? `:${plot.id}` : ''}`,
        kind: 'start_service',
        title: service.label,
        // One short line: the service's own hint, never its catalogue summary.
        context: join([plot ? plotName(plot.number) : undefined, service.hint]),
        cta: COPY.start,
        route: startRoute(item.serviceId, plot?.id),
        urgency: BAND.suggestion * BAND_SIZE + order,
      });
    }
  }
  // One suggestion at a time: the journey has one next step.
  return steps.slice(0, 1);
}

function draftSteps(world: World): NextStep[] {
  return Object.values(world.drafts).flatMap((draft): NextStep[] => {
    const service = getService(draft.serviceId);
    if (!service) return [];
    return [
      {
        id: `draft:${draft.serviceId}`,
        kind: 'start_service',
        title: COPY.continueDraft,
        context: join([service.label, COPY.draftSaved]),
        cta: COPY.continue,
        route: startRoute(draft.serviceId),
        // The most recently saved draft comes first.
        urgency: BAND.draft * BAND_SIZE + (BAND_SIZE - draft.savedAt),
      },
    ];
  });
}

/** Everything the investor should do, most urgent first. Guests get the suggestion that opens the journey. */
export function collectNextSteps(world: World, lookup: DetailLookup): NextStep[] {
  const steps: NextStep[] = [
    ...world.requests.filter((request) => request.status === 'needs_you').map((request) => requestStep(world, request, lookup)),
    ...world.invoices.filter((invoice) => invoice.status !== 'paid').map(invoiceStep),
    ...suggestionSteps(world),
    ...draftSteps(world),
  ];
  return steps.sort((a, b) => a.urgency - b.urgency);
}
