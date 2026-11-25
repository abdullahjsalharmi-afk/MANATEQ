/**
 * Start-up, in the order it happens in the browser: demo links are applied before the workflows have
 * loaded, the world is completed when they arrive. This file starts with an empty catalogue on purpose
 * (every test file has its own module registry), so it must not load the service records up front.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { peekServiceDetail } from '@/data/catalog';
import type { RequestState } from '@/domain/types';
import { startRequest, tick } from '@/state/actions';
import { applyBootParams, loadCatalogue } from '@/state/boot';
import { isCatalogueReady } from '@/state/catalogue';
import { STATE_VERSION, seedIsPartial, seedWorld } from '@/state/seed';
import { selectNextStep, selectNextSteps } from '@/state/selectors';
import { STORAGE_KEY, appStore, getState, resetEverything } from '@/state/store';

afterEach(() => {
  vi.useRealTimers();
});

describe('start-up', () => {
  it('applies a demo link before any workflow is in memory', () => {
    expect(peekServiceDetail('A4')).toBeUndefined();
    expect(isCatalogueReady()).toBe(false);

    applyBootParams('?demo=tenant&lang=en&theme=dark&text=2');
    const state = getState();
    expect(state.settings).toMatchObject({ onboarded: true, lang: 'en', theme: 'dark', textSize: 2 });
    expect(state.world.persona).toBe('tenant');

    // What needs no workflow is there at once: the company, the plots in operation and their accounts.
    expect(seedIsPartial(state.world)).toBe(true);
    expect(state.world.company?.name.en).toBe('Example Industries Co.');
    expect(state.world.plots.map((plot) => plot.number)).toEqual(['BA-121', 'AK-113']);
    expect(state.world.requests).toEqual([]);
    expect(state.world.invoices.filter((invoice) => invoice.status === 'due')).toHaveLength(1);
    expect(selectNextStep(state)?.kind).toBe('invoice');

    // The simulation waits: ticking changes nothing until the workflows arrive.
    tick(Date.now());
    expect(getState()).toBe(state);
  });

  it('keeps a request that is started before its workflow has loaded', () => {
    const id = startRequest('D1', { category: 'roads' }, { plotId: 'BA-121' });
    const queued = getState().world.requests.find((request) => request.id === id) as RequestState;
    expect(queued).toMatchObject({ serviceId: 'D1', visits: [], current: null, status: 'active', plotId: 'BA-121' });
    tick(Date.now());
    expect(getState().world.requests.find((request) => request.id === id)).toBe(queued);
    // The next step is still worked out, from the light catalogue alone.
    expect(selectNextSteps(getState()).length).toBeGreaterThan(0);
  });

  it('completes the world when the workflows arrive, and tells every subscriber', async () => {
    const stale = selectNextSteps(getState());
    let notified = 0;
    const stop = appStore.subscribe(() => notified++);
    await loadCatalogue();
    stop();

    expect(isCatalogueReady()).toBe(true);
    expect(peekServiceDetail('A4')).toBeDefined();
    expect(notified).toBeGreaterThan(0);
    const world = getState().world;
    expect(seedIsPartial(world)).toBe(false);
    expect(world.plots.map((plot) => plot.number).sort()).toEqual(['AK-113', 'AW-116', 'BA-121']);
    expect(world.requests.length).toBeGreaterThan(5);
    expect(world.requests.every((request) => request.visits.length > 0)).toBe(true);
    // What selectors derived before is worked out again with the full catalogue.
    expect(selectNextSteps(getState())).not.toBe(stale);
    expect(selectNextSteps(getState()).map((step) => step.kind)).toEqual(['invoice', 'renewal']);
    // Asking again is harmless.
    await expect(loadCatalogue()).resolves.toBeUndefined();
  });

  it('seeds a whole world at once from here on', () => {
    expect(seedIsPartial(seedWorld('tenant', Date.now()))).toBe(false);
  });
});

describe('demo links', () => {
  it('keeps the saved world when the link names the same profile', () => {
    const before = getState().world;
    applyBootParams('?demo=tenant');
    expect(getState().world).toBe(before);
  });

  it('starts afresh when the link names a different profile', () => {
    applyBootParams('?demo=prospect');
    expect(getState().world.persona).toBe('prospect');
    expect(getState().world.plots).toEqual([]);
    applyBootParams('?demo=guest');
    expect(getState().world.persona).toBe('guest');
    expect(getState().settings.onboarded).toBe(true);
  });

  it('ignores what it does not understand', () => {
    const before = getState();
    applyBootParams('?demo=admin&lang=fr&theme=sepia&text=9&speed=fast&reset=0');
    applyBootParams('');
    expect(getState()).toBe(before);
  });

  it('sets the simulation speed', () => {
    applyBootParams('?speed=0');
    expect(getState().demo.speed).toBe(0);
    applyBootParams('?speed=2.5');
    expect(getState().demo.speed).toBe(2.5);
    applyBootParams('?speed=1');
  });

  it('forgets everything with reset=1, then applies the rest of the link', () => {
    applyBootParams('?demo=tenant&lang=en');
    const first = getState().world;
    applyBootParams('?reset=1&demo=tenant&lang=ar');
    expect(getState().world).not.toBe(first);
    expect(getState().world.persona).toBe('tenant');
    expect(getState().world.requests.length).toBeGreaterThan(5);
    expect(getState().settings).toMatchObject({ lang: 'ar', theme: 'auto', onboarded: true });
    applyBootParams('?reset=1');
    expect(getState().settings.onboarded).toBe(false);
    expect(getState().world.persona).toBe('guest');
  });
});

describe('what this device remembers', () => {
  it('saves the state shortly after a change, under one key', () => {
    vi.useFakeTimers();
    resetEverything();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    applyBootParams('?demo=prospect&lang=en');
    vi.advanceTimersByTime(300);
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: number; settings: { lang: string }; world: { persona: string } };
    expect(saved.version).toBe(STATE_VERSION);
    expect(saved.settings.lang).toBe('en');
    expect(saved.world.persona).toBe('prospect');
  });

  it('restores a saved state of this version and discards anything else', async () => {
    const good = JSON.stringify(getState());
    const load = async () => {
      vi.resetModules();
      return (await import('@/state/store')).getState();
    };

    window.localStorage.setItem(STORAGE_KEY, good);
    expect((await load()).world.persona).toBe('prospect');

    for (const bad of ['not json', '{}', JSON.stringify({ ...getState(), version: STATE_VERSION - 1 }), JSON.stringify({ ...getState(), world: { persona: 'tenant' } }), JSON.stringify({ ...getState(), demo: null })]) {
      window.localStorage.setItem(STORAGE_KEY, bad);
      const restored = await load();
      expect(restored.world.persona, bad.slice(0, 40)).toBe('guest');
      expect(restored.settings.onboarded).toBe(false);
    }
    window.localStorage.removeItem(STORAGE_KEY);
  });
});
