/** Who a D3 emergency report alerts, read from the workflow, and the glyph of each incident type. Pure. */
import { CarFront, Droplets, Flame, ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Workflow } from '@/data/types';

export type AlertedParty = 'control' | 'responders' | 'civilDefence';

/**
 * Incident types for which the emergency services are called at once. The workflow names fire, a major
 * spill or a casualty; only a fire is certain from the type alone, the rest the control room judges.
 */
const AT_ONCE = new Set(['fire']);

export interface Alerted {
  party: AlertedParty;
  /** Alerted now, or only if the control room finds it needed. */
  when: 'now' | 'ifNeeded';
}

/**
 * The parties a report reaches, in the order the workflow alerts them: the control room (Manateq
 * staff), the zone's responders (the field) and the national emergency services. A lane the workflow
 * does not have is left out.
 */
export function alertedParties(workflow: Pick<Workflow, 'steps'>, type: string): Alerted[] {
  const lanes = new Set(workflow.steps.map((step) => step.lane));
  const parties: Alerted[] = [];
  if (lanes.has('staff')) parties.push({ party: 'control', when: 'now' });
  if (lanes.has('field')) parties.push({ party: 'responders', when: 'now' });
  if (lanes.has('nat')) parties.push({ party: 'civilDefence', when: AT_ONCE.has(type) ? 'now' : 'ifNeeded' });
  return parties;
}

const TYPE_ICON: Record<string, LucideIcon> = { fire: Flame, spill: Droplets, accident: CarFront, security: ShieldAlert };

export function incidentIcon(type: string): LucideIcon {
  return TYPE_ICON[type] ?? TriangleAlert;
}
