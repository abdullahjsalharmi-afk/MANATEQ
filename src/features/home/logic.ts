/** Pure helpers of Home: the greeting, which render goes with what, and where a journey item leads. */
import type { RenderName } from '@/design/core';
import type { SolutionKey } from '@/data/types';
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

/**
 * Where an item of a station's checklist leads: its request, the start of the service, the request that was
 * closed (when nothing can be started again from here), or the service page.
 */
export function itemRoute(item: JourneyItem): string {
  if (item.requestId) return `/requests/${item.requestId}`;
  if (item.canStart) return `/start/${item.serviceId}`;
  if (item.stoppedRequestId) return `/requests/${item.stoppedRequestId}`;
  return `/services/${item.serviceId}`;
}

/** The words of a checklist item, as keys of the Home strings table. */
export type ItemWord = 'itemDone' | 'itemCurrent' | 'itemNext' | 'itemClosed' | 'itemStart' | 'itemStartAgain' | 'itemUpcoming';

export interface ItemWords {
  /**
   * `noun`: the item is a request that exists or existed (finished or running), named with `requestLabelOf`.
   * `cta`: something the investor can start, named with the service's call to action.
   */
  name: 'noun' | 'cta';
  /** The status line, in order. */
  status: ItemWord[];
  /** A request for it was withdrawn and the row itself leads elsewhere (to start again): link to it on its own. */
  closedLink: string | undefined;
}

/**
 * How one item of the journey checklist reads. In progress only while a request is open (`open`); the
 * first item not done with nothing open is "next". A withdrawn request is said to be closed.
 */
export function itemWords(item: JourneyItem): ItemWords {
  const startable = item.canStart && !item.open && item.state !== 'done';
  const name = startable ? 'cta' : 'noun';
  if (item.state === 'done') return { name, status: ['itemDone'], closedLink: undefined };
  if (item.open) return { name, status: ['itemCurrent'], closedLink: undefined };
  const status: ItemWord[] = [];
  if (item.state === 'current') status.push('itemNext');
  if (item.stoppedRequestId) status.push('itemClosed');
  if (item.canStart) status.push(item.stoppedRequestId ? 'itemStartAgain' : 'itemStart');
  else if (!item.stoppedRequestId && item.state === 'upcoming') status.push('itemUpcoming');
  const closedLink = item.stoppedRequestId && itemRoute(item) !== `/requests/${item.stoppedRequestId}` ? `/requests/${item.stoppedRequestId}` : undefined;
  return { name, status, closedLink };
}
