/**
 * Chains — which services follow from which. Read from the catalogue's `triggeredBy`:
 *
 * - kind `after` names the services whose completion starts this one by itself
 *   (A4 → A5 → A6 → A7: application → review → offer → contract);
 * - kind `investor` with an `after` list names services the investor starts once the earlier one is
 *   done (A7 → A8: booking the handover unlocks when the contract is signed).
 *
 * Services triggered by a schedule, an outside event or staff are not chained here.
 */
import { services } from '@/data/catalog';
import type { ServiceId, ServiceSummary } from '@/data/types';

export interface Chains {
  /** Services that start by themselves when `id` finishes. */
  followers(id: ServiceId): ServiceId[];
  /** Services the investor can start once `id` has finished. */
  unlocks(id: ServiceId): ServiceId[];
  /** The services whose completion starts `id` by itself. */
  startedBy(id: ServiceId): ServiceId[];
  /** `id` and everything that follows from it automatically, in order (A4 → A5 → A6 → A7 → …). */
  chainFrom(id: ServiceId): ServiceId[];
}

type Trigger = Pick<ServiceSummary, 'id' | 'triggeredBy'>;

export function buildChains(list: Trigger[]): Chains {
  const followers = new Map<ServiceId, ServiceId[]>();
  const unlocks = new Map<ServiceId, ServiceId[]>();
  const startedBy = new Map<ServiceId, ServiceId[]>();

  const add = (index: Map<ServiceId, ServiceId[]>, key: ServiceId, value: ServiceId) => {
    const existing = index.get(key);
    if (existing) existing.push(value);
    else index.set(key, [value]);
  };

  for (const service of list) {
    const { kind, after } = service.triggeredBy;
    if (!after?.length) continue;
    if (kind === 'after') {
      for (const earlier of after) add(followers, earlier, service.id);
      startedBy.set(service.id, [...after]);
    } else if (kind === 'investor') {
      for (const earlier of after) add(unlocks, earlier, service.id);
    }
  }

  const read = (index: Map<ServiceId, ServiceId[]>, id: ServiceId): ServiceId[] => index.get(id) ?? [];

  return {
    followers: (id) => read(followers, id),
    unlocks: (id) => read(unlocks, id),
    startedBy: (id) => read(startedBy, id),
    chainFrom(id) {
      const chain: ServiceId[] = [];
      const queue: ServiceId[] = [id];
      while (queue.length) {
        const next = queue.shift() as ServiceId;
        if (chain.includes(next)) continue;
        chain.push(next);
        queue.push(...read(followers, next));
      }
      return chain;
    },
  };
}

const catalogueChains = buildChains(services);

/** Services that start by themselves when `id` finishes. */
export const followers = (id: ServiceId): ServiceId[] => catalogueChains.followers(id);

/** Services the investor can start once `id` has finished. */
export const unlocks = (id: ServiceId): ServiceId[] => catalogueChains.unlocks(id);

/** The services whose completion starts `id` by itself. */
export const startedBy = (id: ServiceId): ServiceId[] => catalogueChains.startedBy(id);

/** `id` and everything that follows from it automatically, in order. */
export const chainFrom = (id: ServiceId): ServiceId[] => catalogueChains.chainFrom(id);

/**
 * Followers that exist once per plot, whichever earlier service comes first: the utilities case opens
 * at handover or at building completion, never twice. Other followers (a new guarantee after every
 * signature or renewal) start each time.
 */
const ONCE_PER_PLOT = new Set<ServiceId>(['C4']);

export const oncePerPlot = (id: ServiceId): boolean => ONCE_PER_PLOT.has(id);
