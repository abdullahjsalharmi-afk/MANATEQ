/**
 * Typed access to the generated data. Light data (the catalogue of 50 services, reference lists, zones)
 * is available synchronously; the full record of a service is loaded per domain on demand.
 */
import catalogJson from './generated/catalog.json';
import referenceJson from './generated/reference.json';
import zonesJson from './generated/zones.json';
import knowledgeJson from './generated/knowledge.json';
import activitiesJson from './generated/activities.json';
import qatarJson from './generated/qatar.json';
import type {
  Activity,
  Catalog,
  Domain,
  DomainCode,
  Integration,
  Knowledge,
  Pattern,
  Reference,
  ServiceDetail,
  ServiceId,
  ServiceSummary,
  Solution,
  SolutionKey,
  SystemRef,
  Zone,
  ZonesData,
} from './types';

export const catalog = catalogJson as unknown as Catalog;
export const reference = referenceJson as unknown as Reference;
export const zonesData = zonesJson as unknown as ZonesData;
export const knowledge = knowledgeJson as unknown as Knowledge;
export const activities = activitiesJson as unknown as Activity[];
export const qatarMap = qatarJson as unknown as { viewBox: [number, number, number, number]; path: string; note: string };

export const DOMAIN_CODES: DomainCode[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const services: ServiceSummary[] = catalog.services;
export const domains: Domain[] = catalog.domains;
export const zones: Zone[] = zonesData.zones;
export const solutions: Solution[] = zonesData.solutions;

const serviceIndex = new Map<ServiceId, ServiceSummary>(services.map((s) => [s.id, s]));
const domainIndex = new Map<DomainCode, Domain>(domains.map((d) => [d.code, d]));
const zoneIndex = new Map<string, Zone>(zones.map((z) => [z.code, z]));
const solutionIndex = new Map<SolutionKey, Solution>(solutions.map((s) => [s.key, s]));
const integrationIndex = new Map<string, Integration>(reference.integrations.map((i) => [i.id, i]));
const patternIndex = new Map<string, Pattern>(reference.patterns.map((p) => [p.id, p]));
const systemIndex = new Map<string, SystemRef>(reference.systems.map((s) => [s.id, s]));
const activityIndex = new Map<string, Activity>(activities.map((a) => [a.code, a]));

export const getService = (id: ServiceId): ServiceSummary | undefined => serviceIndex.get(id);
export const getDomain = (code: DomainCode): Domain | undefined => domainIndex.get(code);
export const getZone = (code: string): Zone | undefined => zoneIndex.get(code);
export const getSolution = (key: SolutionKey): Solution | undefined => solutionIndex.get(key);
export const getIntegration = (id: string): Integration | undefined => integrationIndex.get(id);
export const getPattern = (id: string): Pattern | undefined => patternIndex.get(id);
export const getSystem = (id: string): SystemRef | undefined => systemIndex.get(id);
export const getActivity = (code: string): Activity | undefined => activityIndex.get(code);

export function servicesOfDomain(code: DomainCode): ServiceSummary[] {
  const domain = domainIndex.get(code);
  if (!domain) return [];
  return domain.services.map((id) => serviceIndex.get(id)).filter((s): s is ServiceSummary => s !== undefined);
}

/** The name to show for a P#/I#/S# code. */
export function enablerName(id: string): { ar: string; en: string } | undefined {
  return integrationIndex.get(id)?.short ?? patternIndex.get(id)?.name ?? systemIndex.get(id)?.name;
}

const loaders: Record<DomainCode, () => Promise<{ default: unknown }>> = {
  A: () => import('./generated/services-A.json'),
  B: () => import('./generated/services-B.json'),
  C: () => import('./generated/services-C.json'),
  D: () => import('./generated/services-D.json'),
  E: () => import('./generated/services-E.json'),
  F: () => import('./generated/services-F.json'),
  G: () => import('./generated/services-G.json'),
};

const detailCache = new Map<ServiceId, ServiceDetail>();
const domainLoads = new Map<DomainCode, Promise<void>>();

function loadDomain(code: DomainCode): Promise<void> {
  let pending = domainLoads.get(code);
  if (!pending) {
    pending = loaders[code]().then((module) => {
      for (const detail of module.default as ServiceDetail[]) detailCache.set(detail.id, detail);
    });
    domainLoads.set(code, pending);
    pending.catch(() => domainLoads.delete(code));
  }
  return pending;
}

/** The full record of a service if it is already in memory. */
export function peekServiceDetail(id: ServiceId): ServiceDetail | undefined {
  return detailCache.get(id);
}

/** Loads the full record of a service (and, with it, the rest of its domain). */
export async function loadServiceDetail(id: ServiceId): Promise<ServiceDetail> {
  const cached = detailCache.get(id);
  if (cached) return cached;
  const summary = serviceIndex.get(id);
  if (!summary) throw new Error(`Unknown service: ${id}`);
  await loadDomain(summary.domain);
  const detail = detailCache.get(id);
  if (!detail) throw new Error(`Service ${id} is missing from its domain file`);
  return detail;
}

/** Loads every domain. The simulation needs all workflows once a persona has requests in several domains. */
export async function loadAllServiceDetails(): Promise<void> {
  await Promise.all(DOMAIN_CODES.map(loadDomain));
}

export function allLoadedDetails(): ServiceDetail[] {
  return [...detailCache.values()];
}
