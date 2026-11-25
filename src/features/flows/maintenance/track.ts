/**
 * The live promise of a maintenance report: received → scheduled → on site → done, read from the real
 * D1 workflow and the request's open step. Pure.
 */
import { Construction, Lightbulb, Network, Signpost, Trees, Waves, Wrench, type LucideIcon } from 'lucide-react';
import type { Workflow } from '@/data/types';
import type { RequestState } from '@/domain/types';

export const TRACK_STAGES = ['received', 'scheduled', 'onSite', 'done'] as const;
export type TrackStage = (typeof TRACK_STAGES)[number];

/**
 * Where a report stands. The field team's step is "on site"; the steps from the dispatch (the branch a
 * new issue takes after the duplicate check) up to it are "scheduled"; everything before is "received".
 * After the field step, a check of the fix still reads "on site", a supervisor re-dispatch reads
 * "scheduled", and anything else (the rating, the closure) reads "done".
 */
export function trackStage(workflow: Pick<Workflow, 'steps'>, request: Pick<RequestState, 'current' | 'status'>): TrackStage {
  if (request.status === 'done') return 'done';
  const steps = workflow.steps;
  const field = steps.find((step) => step.lane === 'field');
  const current = request.current === null ? undefined : steps.find((step) => step.id === request.current);
  if (!field || !current) return 'received';
  const gateBefore = [...steps].reverse().find((step) => step.kind === 'gate' && step.id < field.id);
  const scheduledFrom = gateBefore?.yes ?? field.id;
  if (current.id < scheduledFrom) return 'received';
  if (current.id < field.id) return 'scheduled';
  if (current.id === field.id) return 'onSite';
  if (current.kind === 'gate') return 'onSite';
  if (current.lane === 'staff') return 'scheduled';
  return 'done';
}

/** The state of each stage for a ribbon: the ones behind are done, the one reached is current. */
export function stageStates(stage: TrackStage): Record<TrackStage, 'done' | 'current' | 'upcoming'> {
  const at = TRACK_STAGES.indexOf(stage);
  const entries = TRACK_STAGES.map((key, index) => [key, index < at || (stage === 'done' && index === at) ? 'done' : index === at ? 'current' : 'upcoming'] as const);
  return Object.fromEntries(entries) as Record<TrackStage, 'done' | 'current' | 'upcoming'>;
}

/** A glyph for each issue category of D1. Unknown categories get a wrench. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  roads: Construction,
  lighting: Lightbulb,
  drainage: Waves,
  landscaping: Trees,
  signage: Signpost,
  networks: Network,
};

export function categoryIcon(value: string): LucideIcon {
  return CATEGORY_ICON[value] ?? Wrench;
}
