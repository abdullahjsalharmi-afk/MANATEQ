import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail, ServiceId } from '@/data/types';
import { timingFor } from '@/domain/simulation';
import type { World } from '@/domain/types';
import { findStep } from '@/domain/workflow';
import { emptyWorld } from '@/state/seed';
import { startIn } from '@/state/sim';
import type { Env } from '@/state/types';
import { requestView } from '@/state/view';
import { nextPersonSteps } from '@/features/start/SubmittedState';

const files = import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true });
const all: ServiceDetail[] = Object.values(files).flatMap((m) => m.default);

const NOW = new Date(2026, 10, 19, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const base: World = { ...emptyWorld('tenant'), plots: [{ id: 'p1', number: 'AW-117', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'operating' }] };

beforeAll(async () => {
  await loadAllServiceDetails();
});

describe('the confirmation after starting a service', () => {
  it.each(all.filter((service) => service.startable).map((service) => [service.id] as const))('lists only steps a person or an authority takes for %s', (id) => {
    const service = all.find((s) => s.id === id) as ServiceDetail;
    const { world, id: requestId } = startIn(base, { serviceId: id as ServiceId, plotId: 'p1' }, NOW, live);
    const request = world.requests.find((r) => r.id === requestId);
    expect(request).toBeDefined();
    const view = requestView(request!, service, NOW, 1);
    const steps = nextPersonSteps(view, 3);
    expect(steps.length).toBeLessThanOrEqual(3);
    // It starts at the request's focus, the step the request page describes too.
    if (view.focus) expect(steps[0]).toBe(view.focus.step.id);
    else expect(steps).toEqual([]);
    for (const stepId of steps) {
      const step = findStep(service.workflow, stepId)!;
      expect(['gate', 'stop', 'end'], `${id} step ${stepId}`).not.toContain(step.kind);
      if (step.kind === 'auto') expect(step.lane, `${id} step ${stepId}`).toBe('nat');
    }
  });
});
