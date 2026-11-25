/** Pure helpers of Home: the greeting, which render goes with what, and where a journey item leads. */
import type { RenderName } from '@/design/core';
import type { SolutionKey } from '@/data/types';
import type { NextStep } from '@/domain/types';
import type { JourneyItem, StationKey } from '@/state';

export type Greeting = 'morning' | 'afternoon' | 'evening';

/** The greeting for a local hour: morning until noon, afternoon until six, evening after. */
export function greetingOf(hour: number): Greeting {
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/** The render of each station of the journey (SPEC 3.5). */
export const STATION_RENDER: Record<StationKey, RenderName> = {
  join: 'zone',
  contract: 'plot',
  build: 'construction',
  operate: 'warehouse',
};

/** The render of each of the five solutions (SPEC 3.5). */
export const SOLUTION_RENDER: Record<SolutionKey, RenderName> = {
  industrial: 'factory',
  logistics: 'warehouse',
  commercial: 'showroom',
  openYard: 'yard',
  warehousing: 'units',
};

/** Where an item of a station's checklist leads: its request, the start of the service, or the service page. */
export function itemRoute(item: JourneyItem): string {
  if (item.requestId) return `/requests/${item.requestId}`;
  if (item.canStart) return `/start/${item.serviceId}`;
  return `/services/${item.serviceId}`;
}

/** The invoice a next step pays, when it is an invoice step (its id is `invoice:<invoice id>`). */
export function invoiceOfStep(step: Pick<NextStep, 'id' | 'kind'>): string | null {
  return step.kind === 'invoice' && step.id.startsWith('invoice:') ? step.id.slice('invoice:'.length) : null;
}

/** The service a journey suggestion starts (its id is `start:<service>` or `start:<service>:<plot>`); null for anything else. */
export function suggestedService(step: Pick<NextStep, 'id' | 'kind'>): string | null {
  if (step.kind !== 'start_service' || !step.id.startsWith('start:')) return null;
  return step.id.split(':')[1] ?? null;
}
