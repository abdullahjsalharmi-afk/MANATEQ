/**
 * The catalogue's logic, kept apart from the screens so it can be tested: how services group by journey
 * station, how they are searched (Arabic and English at once), where "start" leads, and the short list
 * of services the investor looked at recently.
 */
import { buildTarget } from '@/app/router';
import { resolveRoute } from '@/app/routes';
import { domains, services as allServices } from '@/data/catalog';
import type { Domain, DomainCode, L10n, ServiceId, ServiceSummary } from '@/data/types';
import type { RenderName } from '@/design/Render/renders';
import type { Persona } from '@/domain/types';
import { buildIndex, normalise, tokens, type SearchIndex } from '@/domain/search';
import type { StationKey } from '@/state';
import { startRedirects } from '@/features/flows/registry';

/** One group of the "my journey" view: a journey station (A to D) or a supporting domain (E to G). */
export interface ServiceGroup {
  domain: Domain;
  /** The plain name of the group, e.g. «الانضمام». */
  name: L10n;
  /** 1 to 4 for the four journey stations; null for the supporting domains. */
  stationNumber: number | null;
  station: StationKey | null;
  render: RenderName;
  services: ServiceSummary[];
}

interface GroupDef {
  code: DomainCode;
  name: L10n;
  station: StationKey | null;
  render: RenderName;
}

/** The journey in the catalogue's words (SPEC 4.3). The order is the order of the journey. */
const GROUPS: GroupDef[] = [
  { code: 'A', station: 'join', render: 'zone', name: { ar: 'الانضمام', en: 'Joining' } },
  { code: 'B', station: 'contract', render: 'plot', name: { ar: 'العقد والحساب', en: 'Contract and account' } },
  { code: 'C', station: 'build', render: 'construction', name: { ar: 'التصميم والبناء', en: 'Design and build' } },
  { code: 'D', station: 'operate', render: 'utilities', name: { ar: 'التشغيل', en: 'Operations' } },
  { code: 'E', station: null, render: 'services', name: { ar: 'الدعم', en: 'Support' } },
  { code: 'F', station: null, render: 'units', name: { ar: 'التخزين', en: 'Warehousing' } },
  { code: 'G', station: null, render: 'gate', name: { ar: 'خدمات مؤسسية', en: 'Corporate services' } },
];

const RENDER_OF_DOMAIN = Object.fromEntries(GROUPS.map((group) => [group.code, group.render])) as Record<DomainCode, RenderName>;

/** The building render that stands for a service's domain (SPEC 3.5). */
export function renderOfDomain(code: DomainCode): RenderName {
  return RENDER_OF_DOMAIN[code];
}

/** The plain group name of a domain («التصميم والبناء»). */
export function groupNameOf(code: DomainCode): L10n {
  return GROUPS.find((group) => group.code === code)?.name ?? { ar: code, en: code };
}

/**
 * The services grouped by journey station, the investor's current station first. Only `visible`
 * services are kept and empty groups are left out, so the same function serves the filtered view.
 */
export function groupServices(station: StationKey, visible: readonly ServiceSummary[] = allServices): ServiceGroup[] {
  const keep = new Set(visible.map((service) => service.id));
  const groups: ServiceGroup[] = [];
  let stationNumber = 0;
  for (const def of GROUPS) {
    const domain = domains.find((d) => d.code === def.code);
    if (def.station) stationNumber += 1;
    if (!domain) continue;
    const list = domain.services.map((id) => allServices.find((s) => s.id === id)).filter((s): s is ServiceSummary => s !== undefined && keep.has(s.id));
    if (!list.length) continue;
    groups.push({ domain, name: def.name, station: def.station, stationNumber: def.station ? stationNumber : null, render: def.render, services: list });
  }
  const current = groups.findIndex((group) => group.station === station);
  if (current > 0) {
    const [first] = groups.splice(current, 1);
    if (first) groups.unshift(first);
  }
  return groups;
}

export type ServiceFilter = 'all' | 'startable' | 'automatic';

export function filterServices(list: readonly ServiceSummary[], filter: ServiceFilter): ServiceSummary[] {
  if (filter === 'startable') return list.filter((service) => service.startable);
  if (filter === 'automatic') return list.filter((service) => !service.startable);
  return [...list];
}

/** A search over services that also forgives: when no service matches every word, it ranks services by how many words they match. */
export interface ServiceSearch {
  search(query: string): ServiceSummary[];
}

export function makeServiceSearch(list: readonly ServiceSummary[] = allServices): ServiceSearch {
  const index: SearchIndex<ServiceSummary> = buildIndex(
    list.map((service) => ({ item: service, fields: [service.label, service.name, service.summary, service.promise], keys: [service.id] })),
  );
  return {
    search(query) {
      const exact = index.search(query, list.length);
      if (exact.length) return exact;
      const words = query.split(/\s+/).filter((word) => tokens(word).some((token) => token.length >= 3));
      if (words.length < 2) return [];
      const hits = new Map<ServiceId, { service: ServiceSummary; count: number; rank: number }>();
      for (const word of words) {
        index.search(word, list.length).forEach((service, rank) => {
          const hit = hits.get(service.id);
          if (hit) {
            hit.count += 1;
            hit.rank = Math.min(hit.rank, rank);
          } else hits.set(service.id, { service, count: 1, rank });
        });
      }
      return [...hits.values()].sort((a, b) => b.count - a.count || a.rank - b.rank).map((hit) => hit.service);
    },
  };
}

let shared: ServiceSearch | undefined;

/** The search over the whole catalogue, built once. */
export function serviceSearch(): ServiceSearch {
  shared ??= makeServiceSearch();
  return shared;
}

/** Compares a typed reference ("mq 2611 42", "2611-0042") with a request reference ("MQ-2611-0042"). */
export function matchesReference(ref: string, query: string): boolean {
  const compact = (text: string) => normalise(text).replace(/\s+/g, '');
  const wanted = compact(query);
  if (wanted.length < 3 || !/\d/.test(wanted)) return false;
  return compact(ref).includes(wanted);
}

/**
 * Where "start" leads: a service with its own screen opens it (the eligibility check is open to guests);
 * a guest is asked to sign in first and comes back here after; everyone else starts the generic or bespoke flow.
 */
export function startTarget(id: ServiceId, persona: Persona): string {
  const redirect = startRedirects[id];
  if (redirect) {
    if (persona !== 'guest' || resolveRoute(redirect)?.route.open) return redirect;
    return signInThen(redirect);
  }
  return persona === 'guest' ? signInThen(`/start/${id}`) : `/start/${id}`;
}

/** The welcome screen, asked to bring the guest back to `next` once signed in: "/welcome?next=%2Fstart%2FD1" (the same address the app shell builds for a deep link). */
export function signInThen(next: string): string {
  return buildTarget('/welcome', { next });
}

/** Where an automatic service is followed, for the quiet link under its explanation. */
export type FollowKey = 'payments' | 'wallet' | 'notifications' | 'requests';

const FOLLOW: Partial<Record<ServiceId, FollowKey>> = {
  B1: 'payments',
  B9: 'payments',
  B10: 'payments',
  G5: 'wallet',
  E7: 'notifications',
  A5: 'requests',
  A6: 'requests',
  A7: 'requests',
  B2: 'requests',
  B3: 'requests',
  C2: 'requests',
  C3: 'requests',
  C4: 'requests',
  C7: 'requests',
  C8: 'requests',
  D4: 'requests',
  D6: 'requests',
};

export const FOLLOW_ROUTE: Record<FollowKey, string> = {
  payments: '/account/payments',
  wallet: '/account/wallet',
  notifications: '/notifications',
  requests: '/requests',
};

/** Where the investor follows a service that starts by itself; undefined when there is nothing to follow in the app. */
export function followOf(id: ServiceId): FollowKey | undefined {
  return FOLLOW[id];
}

/* Recently viewed services: a per-viewer convenience kept in the browser; it may be missing at any time. */

const RECENT_KEY = 'mq.services.recent';
const RECENT_MAX = 5;

export function readRecent(): ServiceId[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && allServices.some((s) => s.id === id)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberService(id: ServiceId): void {
  try {
    const next = [id, ...readRecent().filter((other) => other !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the list simply stays empty.
  }
}
